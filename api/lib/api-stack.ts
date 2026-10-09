import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { LambdaApiUtil } from './lambda_handler/util/LambdaApiUtil';

interface ApiStackProps extends cdk.StackProps {
  stage: string;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ApiStackProps) {
    super(scope, id, props);

    const env = props ? props.stage : 'dev';
    const api = new RestApi(this, 'GolfLeagueManager-' + env, {
      restApiName: 'Golf League Manager API - ' + env,
    });
    const apiUtil = new LambdaApiUtil(this);

    apiUtil.createApi(api, env, 'golfleague-login', 'login.ts', 'login', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-accountlink', 'accountlink.ts', 'accountlink', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-register', 'register.ts', 'register', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-logout', 'logout.ts', 'logout', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-user', 'user.ts', 'user', ['POST', 'PUT']);
    apiUtil.createApi(api, env, 'golfleague-leagues', 'leagues.ts', 'leagues', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-league', 'league.ts', 'league', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-seasons', 'seasons.ts', 'seasons', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-season', 'season.ts', 'season', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-events', 'events.ts', 'events', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-event', 'event.ts', 'event', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-eventsignup', 'eventsignup.ts', 'eventsignup', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-registration', 'registration.ts', 'registration', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-round', 'round.ts', 'round', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-team', 'team.ts', 'team', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-group', 'group.ts', 'group', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-score', 'score.ts', 'score', ['PUT']);
    apiUtil.createApi(api, env, 'golfleague-scorecard', 'scorecard.ts', 'scorecard', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-leaderboard', 'leaderboard.ts', 'leaderboard', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-money', 'money.ts', 'money', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-dashboard', 'dashboard.ts', 'dashboard', ['POST']);
    apiUtil.createApi(api, env, 'golfleague-payout', 'payout.ts', 'payout', ['PUT', 'DELETE']);
    apiUtil.createApi(api, env, 'golfleague-sidegame', 'sidegame.ts', 'sidegame', ['PUT']);

    const imagesBucket = `${env}-golfleague-krummy-net-images`;
    const imageBaseUrl = env === 'prod'
      ? 'https://golfleague.krummy.net'
      : 'https://dev.golfleague.krummy.net';
    apiUtil.createApi(api, env, 'golfleague-image', 'image.ts', 'image', ['POST'], undefined, {
      environment: {
        IMAGE_BUCKET: imagesBucket,
        IMAGE_BASE_URL: imageBaseUrl,
      },
      policyStatements: [
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`arn:aws:s3:::${imagesBucket}/*`],
        }),
      ],
    });
  }
}
