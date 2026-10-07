import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { archiveEvent, hardDeleteEvent, saveEvent, setEventScoring } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    const eventId = Number(body.id);
    if (body.action === 'archive') {
      if (!eventId) throw new HttpError('Event is required');
      return archiveEvent(client, user, eventId);
    }
    if (body.action === 'hardDelete') {
      if (!eventId) throw new HttpError('Event is required');
      return hardDeleteEvent(client, user, eventId);
    }
    if (body.action === 'setScoring') {
      if (!eventId) throw new HttpError('Event is required');
      return setEventScoring(client, user, eventId, Boolean(body.scoringEnabled));
    }
    return saveEvent(client, user, body);
  });
});
