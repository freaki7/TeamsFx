// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SystemError,
  SystemErrorOptions,
  UserError,
  UserErrorOptions,
} from "@microsoft/teamsfx-api";
import { getDefaultString, getLocalizedString } from "../../../../common/localizeUtils";

const errorCode = "UnhandledError";
const messageKey = "driver.aadApp.error.unhandledError";

export class UnhandledUserError extends UserError {
  constructor(actionName: string, detail: string, helpLink: string) {
    const errorOptions = generateErrorOptions(actionName, detail) as UserErrorOptions;
    errorOptions.helpLink = helpLink;
    super(errorOptions);
  }
}

export class UnhandledSystemError extends SystemError {
  constructor(actionName: string, detail: string) {
    const errorOptions = generateErrorOptions(actionName, detail) as SystemErrorOptions;
    super(errorOptions);
  }
}

function generateErrorOptions(
  actionName: string,
  detail: string
): UserErrorOptions | SystemErrorOptions {
  return {
    source: actionName,
    name: errorCode,
    message: getDefaultString(messageKey, actionName, detail),
    displayMessage: getLocalizedString(messageKey, actionName, detail),
  };
}
