// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AzureResourceInfo, DeployStepArgs, DriverContext } from "../interface/buildAndDeployArgs";
import { AzureDeployDriver } from "./azureDeployDriver";
import { StepDriver } from "../interface/stepDriver";
import { Service } from "typedi";
import { TokenCredential } from "@azure/identity";

@Service("deploy/azureAppService")
export class AzureAppServiceDeployDriver implements StepDriver {
  async run(args: unknown, context: DriverContext): Promise<Map<string, string>> {
    const impl = new AzureAppServiceDeployDriverImpl(args, context);
    return await impl.run();
  }
}

export class AzureAppServiceDeployDriverImpl extends AzureDeployDriver {
  pattern =
    /\/subscriptions\/([^\/]*)\/resourceGroups\/([^\/]*)\/providers\/Microsoft.Web\/serverFarms\/([^\/]*)/i;

  async azureDeploy(
    args: DeployStepArgs,
    azureResource: AzureResourceInfo,
    azureCredential: TokenCredential
  ): Promise<void> {
    await this.zipDeploy(args, azureResource, azureCredential);
  }
}