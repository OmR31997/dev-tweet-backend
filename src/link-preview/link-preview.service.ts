import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ogs from 'open-graph-scraper';
import type { ErrorResult, OgObject } from 'open-graph-scraper/types';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { getAppUrl } from '../config/app-url';

export type LinkPreviewResult = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const FETCH_TIMEOUT_SECONDS = 6;

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(private readonly configService: ConfigService) {}

  private linkPreviewUserAgent(): string {
    const appUrl = getAppUrl(this.configService);
    const origin = appUrl || 'https://invalid.local';
    return `DevTweetHubLinkPreview/1.0 (+${origin})`;
  }

  async preview(rawUrl: string): Promise<LinkPreviewResult> {
    const url = await this.assertSafeUrl(rawUrl);

    let data: Awaited<ReturnType<typeof ogs>>;
    try {
      data = await ogs({
        url: url.toString(),
        timeout: FETCH_TIMEOUT_SECONDS,
        fetchOptions: {
          headers: {
            'User-Agent': this.linkPreviewUserAgent(),
            Accept: 'text/html,application/xhtml+xml',
          },
        },
      });
    } catch (error) {
      const ogsError = error as ErrorResult;
      this.logger.warn(
        `open-graph-scraper failed for ${url}: ${ogsError.result?.error ?? error}`,
      );
      throw new ServiceUnavailableException('Could not fetch link preview');
    }

    if (data.error) {
      this.logger.warn(
        `open-graph-scraper error for ${url}: ${data.result.error}`,
      );
      throw new ServiceUnavailableException('Could not fetch link preview');
    }

    return this.mapOgResult(url.toString(), data.result);
  }

  private mapOgResult(requestUrl: string, result: OgObject): LinkPreviewResult {
    const title = this.pickString(
      result.ogTitle,
      result.twitterTitle,
      result.dcTitle,
    );
    const description = this.pickString(
      result.ogDescription,
      result.twitterDescription,
      result.dcDescription,
    );
    const image = this.pickImage(result);
    const siteName =
      this.pickString(result.ogSiteName) ?? this.hostname(requestUrl);

    if (!title && !description && !image) {
      return {
        url: result.ogUrl ?? result.requestUrl ?? requestUrl,
        siteName,
      };
    }

    return {
      url: result.ogUrl ?? result.requestUrl ?? requestUrl,
      title,
      description,
      image,
      siteName,
    };
  }

  private pickString(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
      const trimmed = value?.trim();
      if (trimmed) return trimmed;
    }
    return undefined;
  }

  private pickImage(result: OgObject): string | undefined {
    const fromOg = result.ogImage?.[0]?.url?.trim();
    if (fromOg) return fromOg;

    const fromTwitter = result.twitterImage?.[0]?.url?.trim();
    if (fromTwitter) return fromTwitter;

    return undefined;
  }

  private async assertSafeUrl(rawUrl: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only HTTP(S) URLs are supported');
    }

    if (parsed.username || parsed.password) {
      throw new BadRequestException('URL credentials are not allowed');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      throw new BadRequestException('Local URLs are not allowed');
    }

    if (isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new BadRequestException('Private network URLs are not allowed');
      }
      return parsed;
    }

    const records = await lookup(hostname, { all: true });
    for (const record of records) {
      if (this.isPrivateIp(record.address)) {
        throw new BadRequestException('Private network URLs are not allowed');
      }
    }

    return parsed;
  }

  private isPrivateIp(address: string): boolean {
    if (address === '::1') return true;
    if (
      address.startsWith('fe80:') ||
      address.startsWith('fc') ||
      address.startsWith('fd')
    ) {
      return true;
    }

    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      return false;
    }

    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  private hostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
      return url;
    }
  }
}
