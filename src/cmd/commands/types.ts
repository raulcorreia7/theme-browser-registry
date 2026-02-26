export interface CommandResult {
  readonly success: boolean;
  readonly message?: string | undefined;
  readonly exitCode: number;
}

export function createCommandResult(
  success: boolean,
  message?: string | undefined,
  exitCode = 0
): CommandResult {
  return { success, message, exitCode };
}

export function success(message?: string | undefined): CommandResult {
  return createCommandResult(true, message, 0);
}

export function failure(message: string, exitCode = 1): CommandResult {
  return createCommandResult(false, message, exitCode);
}
