import { Construct } from 'constructs';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'node:path';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface CreateApiOptions {
  environment?: Record<string, string>;
  policyStatements?: iam.PolicyStatement[];
}

export class LambdaApiUtil {
  constructor(private scope: Construct) {}

  createApi(
    api: RestApi,
    environmentPrefix: string,
    functionName: string,
    functionFileName: string,
    resourceName: string,
    httpMethods: Array<string>,
    timeoutInSeconds?: number,
    options?: CreateApiOptions
  ): void {
    const nodeJsFunctionProps = this.getNodeJsFunctionProps(environmentPrefix);

    const fn = new NodejsFunction(this.scope, `${environmentPrefix}-${functionName}`, {
      functionName: `${environmentPrefix}-${functionName}`,
      entry: path.join(__dirname, '../functions/' + functionFileName),
      ...nodeJsFunctionProps,
      environment: {
        ...nodeJsFunctionProps.environment,
        ...options?.environment,
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );
    for (const statement of options?.policyStatements ?? []) {
      fn.addToRolePolicy(statement);
    }

    const integration = new LambdaIntegration(fn);
    const items = api.root.addResource(resourceName);
    for (const method of httpMethods) {
      items.addMethod(method, integration);
    }

    this.addCorsOptions(items);
  }

  static buildResponse(statusCode: number, responseBody: any): any {
    return {
      statusCode: statusCode,
      body: JSON.stringify(responseBody),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  }

  private addCorsOptions(apiResource: IResource) {
    apiResource.addMethod(
      'OPTIONS',
      new MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers':
                "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,username'",
              'method.response.header.Access-Control-Allow-Origin': "'*'",
              'method.response.header.Access-Control-Allow-Credentials': "'false'",
              'method.response.header.Access-Control-Allow-Methods':
                "'OPTIONS,GET,PUT,POST,DELETE,PATCH'",
            },
          },
        ],
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
              'method.response.header.Access-Control-Allow-Credentials': true,
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );
  }

  private getNodeJsFunctionProps(env: string): NodejsFunctionProps {
    const props: NodejsFunctionProps = {
      bundling: {
        externalModules: ['aws-sdk'],
      },
      runtime: Runtime.NODEJS_LATEST,
      environment: {
        STAGE: env,
      },
    };

    return props;
  }
}
