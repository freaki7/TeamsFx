{
  "appName": "{{appName}}",
  "version": "2.1.0",
  "components": [
    {
      "name": "teams-bot",
      "hosting": "azure-function",
      "provision": false,
      "deploy": true,
      "capabilities": ["notification"],
      "build": true,
      "folder": "bot"
    },
    {
      "name": "bot-service",
      "provision": true
    },
    {
      "name": "azure-function",
      "scenario": "Bot",
      "connections": ["identity", "teams-bot"]
    },
    {
      "name": "identity",
      "provision": true
    }
  ],
  "programmingLanguage": "typescript",
  "solutionSettings": {
    "name": "fx-solution-azure",
    "version": "1.0.0",
    "hostType": "Azure",
    "azureResources": [],
    "capabilities": [],
    "activeResourcePlugins": [
      "fx-resource-local-debug",
      "fx-resource-appstudio",
      "fx-resource-cicd",
      "fx-resource-api-connector",
      "fx-resource-bot",
      "fx-resource-identity"
    ]
  },
  "pluginSettings": {
    "fx-resource-bot": {
      "host-type": "azure-function",
      "capabilities": ["notification"]
    }
  }
}
