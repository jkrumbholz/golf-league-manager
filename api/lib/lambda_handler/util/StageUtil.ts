export class StageUtil {
  static getStage(): string {
    return process.env.STAGE || 'dev';
  }
}
