/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import { assembleError, FxError, Result } from "@microsoft/teamsfx-api";
import { showError } from "../../handlers";
import { getDefaultString, localize } from "../../utils/localizeUtils";
import { outputPanelCommand } from "../constants";

const ControlCodes = {
  CtrlC: "\u0003",
};

// TODO: ensure local debug session in teamsfx task
export abstract class BaseTaskTerminal implements vscode.Pseudoterminal {
  protected writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  protected closeEmitter = new vscode.EventEmitter<number>();
  onDidClose?: vscode.Event<number> = this.closeEmitter.event;

  constructor(private taskDefinition: vscode.TaskDefinition) {}

  open(): void {
    this.do()
      .then((res) => {
        const error = res.isErr() ? res.error : undefined;
        this.stop(error);
      })
      .catch((error) => this.stop(error));
  }

  close(): void {
    this.stop();
  }

  handleInput(data: string): void {
    if (data.includes(ControlCodes.CtrlC)) {
      this.stop();
    }
  }

  protected stop(error?: any): void {
    if (error) {
      // TODO: add color
      const defaultOutputPanel = getDefaultString("teamstoolkit.localDebug.outputPanel");
      const localizeOutputPanel = localize("teamstoolkit.localDebug.outputPanel");
      const errorMessage = error?.message?.replace(
        `[${defaultOutputPanel}](${outputPanelCommand})`,
        defaultOutputPanel
      );
      const displayErrorMessage = error?.displayMessage?.replace(
        `[${localizeOutputPanel}](${outputPanelCommand})`,
        localizeOutputPanel
      );

      this.writeEmitter.fire(`${displayErrorMessage ?? errorMessage}\r\n`);
      showError(assembleError(error));
      this.closeEmitter.fire(1);
    }
    this.closeEmitter.fire(0);
  }

  protected abstract do(): Promise<Result<void, FxError>>;
}