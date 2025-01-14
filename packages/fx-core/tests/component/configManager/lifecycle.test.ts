// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { assert } from "chai";
import { describe, it } from "mocha";
import mockedEnv, { RestoreFn } from "mocked-env";
import sinon from "sinon";
import { Lifecycle } from "../../../src/component/configManager/lifecycle";
import Container from "typedi";
import { DriverDefinition } from "../../../src/component/configManager/interface";
import {
  MockedAzureAccountProvider,
  MockedLogProvider,
  MockedM365Provider,
  MockedTelemetryReporter,
  MockedUserInteraction,
} from "../../plugins/solution/util";
import { DriverContext } from "../../../src/component/driver/interface/commonArgs";
import { Platform, Result, FxError, ok, err } from "@microsoft/teamsfx-api";
import { StepDriver } from "../../../src/component/driver/interface/stepDriver";

const mockedDriverContext: DriverContext = {
  m365TokenProvider: new MockedM365Provider(),
  azureAccountProvider: new MockedAzureAccountProvider(),
  ui: new MockedUserInteraction(),
  logProvider: new MockedLogProvider(),
  telemetryReporter: new MockedTelemetryReporter(),
  projectPath: "",
  platform: Platform.VSCode,
};

class DriverA implements StepDriver {
  async run(args: unknown, context: DriverContext): Promise<Result<Map<string, string>, FxError>> {
    return ok(new Map([["OUTPUT_A", "VALUE_A"]]));
  }
}

class DriverB implements StepDriver {
  async run(args: unknown, context: DriverContext): Promise<Result<Map<string, string>, FxError>> {
    return ok(new Map([["OUTPUT_B", "VALUE_B"]]));
  }
}

class DriverThatCapitalize implements StepDriver {
  async run(
    args: { INPUT_A: string },
    context: DriverContext
  ): Promise<Result<Map<string, string>, FxError>> {
    return ok(new Map([["OUTPUT", args.INPUT_A.toUpperCase()]]));
  }
}

class DriverThatLowercase implements StepDriver {
  async run(
    args: { INPUT_A: string },
    context: DriverContext
  ): Promise<Result<Map<string, string>, FxError>> {
    return ok(new Map([["OUTPUT_C", args.INPUT_A.toLowerCase()]]));
  }
}

describe("v3 lifecyle", () => {
  describe("when driver name not found", () => {
    const sandbox = sinon.createSandbox();
    before(() => {
      sandbox.stub(Container, "has").returns(false);
    });

    afterEach(() => {
      sandbox.restore();
    });
    it("should return error", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        name: "xxx",
        uses: "xxx",
        with: {},
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(result.isErr() && result.error.name === "DriverNotFoundError");
    });
  });

  describe("when run with multiple drivers", () => {
    class DriverThatReturnsError implements StepDriver {
      async run(
        args: unknown,
        context: DriverContext
      ): Promise<Result<Map<string, string>, FxError>> {
        const fxError: FxError = {
          name: "fakeError",
          message: "fake message",
          source: "xxx",
          timestamp: new Date(),
        };
        return err(fxError);
      }
    }

    const sandbox = sinon.createSandbox();
    before(() => {
      sandbox
        .stub(Container, "has")
        .withArgs(sandbox.match("DriverA"))
        .returns(true)
        .withArgs(sandbox.match("DriverB"))
        .returns(true)
        .withArgs(sandbox.match("DriverThatReturnsError"))
        .returns(true);
      sandbox
        .stub(Container, "get")
        .withArgs(sandbox.match("DriverA"))
        .returns(new DriverA())
        .withArgs(sandbox.match("DriverB"))
        .returns(new DriverB())
        .withArgs(sandbox.match("DriverThatReturnsError"))
        .returns(new DriverThatReturnsError());
    });

    after(() => {
      sandbox.restore();
    });

    it("should return combined output", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        name: "xxx",
        uses: "DriverA",
        with: {},
      });
      driverDefs.push({
        name: "xxx",
        uses: "DriverB",
        with: {},
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(
        result.isOk() &&
          result.value.unresolvedPlaceHolders.length === 0 &&
          result.value.env.size === 2 &&
          result.value.env.get("OUTPUT_A") === "VALUE_A" &&
          result.value.env.get("OUTPUT_B") === "VALUE_B"
      );
    });

    it("should return error if one of the driver returns error", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        name: "xxx",
        uses: "DriverA",
        with: {},
      });
      driverDefs.push({
        name: "xxx",
        uses: "DriverB",
        with: {},
      });

      driverDefs.push({
        name: "xxx",
        uses: "DriverThatReturnsError",
        with: {},
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(result.isErr() && result.error.name === "fakeError");
    });
  });

  describe("when run with valid placeholders", async () => {
    const sandbox = sinon.createSandbox();
    let restoreFn: RestoreFn | undefined = undefined;

    before(() => {
      restoreFn = mockedEnv({
        SOME_ENV_VAR: "xxx",
      });
      sandbox.stub(Container, "has").withArgs(sandbox.match("DriverThatCapitalize")).returns(true);
      sandbox
        .stub(Container, "get")
        .withArgs(sandbox.match("DriverThatCapitalize"))
        .returns(new DriverThatCapitalize());
    });

    after(() => {
      if (restoreFn) {
        restoreFn();
      }
      sandbox.restore();
    });

    it("should replace all placeholders", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        uses: "DriverThatCapitalize",
        with: { INPUT_A: "hello ${{ SOME_ENV_VAR }}" },
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(
        result.isOk() &&
          result.value.unresolvedPlaceHolders.length === 0 &&
          result.value.env.get("OUTPUT") === "HELLO XXX"
      );
    });
  });

  describe("when run with multiple valid placeholders", async () => {
    const sandbox = sinon.createSandbox();
    let restoreFn: RestoreFn | undefined = undefined;

    before(() => {
      restoreFn = mockedEnv({
        SOME_ENV_VAR: "xxx",
        OTHER_ENV_VAR: "yyy",
      });
      sandbox
        .stub(Container, "has")
        .withArgs(sandbox.match("DriverThatCapitalize"))
        .returns(true)
        .withArgs(sandbox.match("DriverThatLowercase"))
        .returns(true);
      sandbox
        .stub(Container, "get")
        .withArgs(sandbox.match("DriverThatCapitalize"))
        .returns(new DriverThatCapitalize())
        .withArgs(sandbox.match("DriverThatLowercase"))
        .returns(new DriverThatLowercase());
    });

    after(() => {
      if (restoreFn) {
        restoreFn();
      }
      sandbox.restore();
    });

    it("should replace all placeholders for a single driver", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        uses: "DriverThatCapitalize",
        with: { INPUT_A: "hello ${{ SOME_ENV_VAR }} and ${{OTHER_ENV_VAR}}" },
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(
        result.isOk() &&
          result.value.unresolvedPlaceHolders.length === 0 &&
          result.value.env.get("OUTPUT") === "HELLO XXX AND YYY"
      );
    });

    it("should replace all placeholders for every driver", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        uses: "DriverThatCapitalize",
        with: { INPUT_A: "hello ${{ SOME_ENV_VAR }}" },
      });
      driverDefs.push({
        uses: "DriverThatLowercase",
        with: { INPUT_A: "Hello ${{OTHER_ENV_VAR}}" },
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(
        result.isOk() &&
          result.value.unresolvedPlaceHolders.length === 0 &&
          result.value.env.get("OUTPUT") === "HELLO XXX" &&
          result.value.env.get("OUTPUT_C") === "hello yyy"
      );
    });
  });

  describe("when run with unresolved placeholders", async () => {
    const sandbox = sinon.createSandbox();

    before(() => {
      sandbox
        .stub(Container, "has")
        .withArgs(sandbox.match("DriverThatCapitalize"))
        .returns(true)
        .withArgs(sandbox.match("DriverThatLowercase"))
        .returns(true);
      sandbox
        .stub(Container, "get")
        .withArgs(sandbox.match("DriverThatCapitalize"))
        .returns(new DriverThatCapitalize())
        .withArgs(sandbox.match("DriverThatLowercase"))
        .returns(new DriverThatLowercase());
    });

    after(() => {
      sandbox.restore();
    });

    it("should return unresolved placeholders", async () => {
      const driverDefs: DriverDefinition[] = [];
      driverDefs.push({
        uses: "DriverThatCapitalize",
        with: { INPUT_A: "hello ${{ SOME_ENV_VAR }} ${{AAA}} ${{BBB}}" },
      });
      driverDefs.push({
        uses: "DriverThatLowercase",
        with: { INPUT_A: "${{CCC}} Hello ${{OTHER_ENV_VAR}}" },
      });

      const lifecycle = new Lifecycle("configureApp", driverDefs);
      const result = await lifecycle.run(mockedDriverContext);
      assert(
        result.isOk() &&
          result.value.unresolvedPlaceHolders.length === 5 &&
          result.value.unresolvedPlaceHolders.some((x) => x === "SOME_ENV_VAR") &&
          result.value.unresolvedPlaceHolders.some((x) => x === "AAA") &&
          result.value.unresolvedPlaceHolders.some((x) => x === "BBB") &&
          result.value.unresolvedPlaceHolders.some((x) => x === "CCC") &&
          result.value.unresolvedPlaceHolders.some((x) => x === "OTHER_ENV_VAR") &&
          result.value.env.size === 0
      );
    });
  });
});
