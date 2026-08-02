export type AutomationWorkspaceControl = {
  workspaceId: string;
  backlinksEnabled: boolean;
  dryRunOnly: true;
  createdAt: string;
  updatedAt: string;
};

export type AutomationWorkspaceControlRecord = {
  workspaceId: string;
  backlinksEnabled: boolean;
  dryRunOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GetOrCreateAutomationWorkspaceControlInput = {
  workspaceId: string;
};

export type GetOrCreateAutomationWorkspaceControlResult =
  | {
      kind: "created";
      control: AutomationWorkspaceControl;
    }
  | {
      kind: "existing";
      control: AutomationWorkspaceControl;
    };

export type UpdateAutomationWorkspaceControlInput = {
  workspaceId: string;
  backlinksEnabled: boolean;
};

export type UpdateAutomationWorkspaceControlResult = {
  kind: "updated";
  control: AutomationWorkspaceControl;
};
