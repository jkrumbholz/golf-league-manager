#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { AppStage } from '../lib/config';

/* For prod deploy run:

cdk deploy -c stage=prod

*/

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';

new ApiStack(app, `${stage}-GolfLeagueManagerApiStack`, {
  description: stage,
  env: AppStage[stage],
  stage: stage
});
