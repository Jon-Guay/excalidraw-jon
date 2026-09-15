export type HealthResponse = {
  status: "ok";
  migrationVersion: string;
};

export type LivenessResponse = {
  status: "ok";
};
