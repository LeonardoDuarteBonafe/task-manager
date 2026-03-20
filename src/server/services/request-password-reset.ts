type PasswordResetRequestInput = {
  email: string;
};

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  return {
    email: input.email.trim().toLowerCase(),
    sent: true,
  };
}
