// Bangladesh mobile numbers only: +880 followed by 1, an operator digit
// (3-9), then 8 more digits — e.g. +8801712345678. Registration/phone-change
// were accepting any string here, which let bots register with random
// international numbers and trigger OTP SMS sends at our expense.
export const BD_PHONE_REGEX = /^\+8801[3-9]\d{8}$/;
export const BD_PHONE_MESSAGE =
  'Phone number must be a valid Bangladeshi number in the format +8801XXXXXXXXX';
