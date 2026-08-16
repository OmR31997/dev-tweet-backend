import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  isAllowedSignupEmail,
  SIGNUP_EMAIL_REJECTED_MESSAGE,
} from '../email-policy';

@ValidatorConstraint({ name: 'IsNotDisposableEmail', async: false })
export class IsNotDisposableEmailConstraint implements ValidatorConstraintInterface {
  validate(email: unknown) {
    if (typeof email !== 'string') {
      return false;
    }
    return isAllowedSignupEmail(email);
  }

  defaultMessage() {
    return SIGNUP_EMAIL_REJECTED_MESSAGE;
  }
}

export function IsNotDisposableEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotDisposableEmailConstraint,
    });
  };
}
