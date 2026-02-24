export interface CommandResult {
  readonly success: boolean;
  readonly message?: string;
  readonly exitCode: number;
}

export function createCommandResult(
  success: boolean,
  message?: string,
  exitCode = 0
): CommandResult {
  return { success, message, exitCode };
}

export function success(message?: string): CommandResult {
  return createCommandResult(true, message, 0);
}

export function failure(message: string, exitCode = 1): CommandResult {
  return createCommandResult(false, message, exitCode);
}
