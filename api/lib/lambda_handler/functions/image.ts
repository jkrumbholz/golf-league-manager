import { Handler } from 'aws-cdk-lib/aws-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { assertOrganizer, requireUser } from '../util/auth';

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const s3 = new S3Client({});

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    const rawType = String(body.contentType || '').toLowerCase();
    const contentType = rawType === 'image/jpg' || rawType === 'image/pjpeg' ? 'image/jpeg' : rawType;
    const extension = EXTENSIONS[contentType];
    if (!extension) throw new HttpError('Use a JPEG, PNG, or WebP image');

    const bucket = process.env.IMAGE_BUCKET;
    const baseUrl = process.env.IMAGE_BASE_URL?.replace(/\/$/, '');
    if (!bucket || !baseUrl) throw new HttpError('Image storage is not configured', 500);

    // Keys start with images/ so they match the /images/* path the site distribution
    // forwards to the images bucket. No second CloudFront distribution.
    let key: string;
    if (body.kind === 'profile') {
      key = `images/users/${user.id}/profile.${extension}`;
    } else if (body.kind === 'leagueLogo') {
      const leagueId = Number(body.leagueId);
      if (!leagueId) throw new HttpError('League is required');
      await assertOrganizer(client, leagueId, user.id);
      key = `images/leagues/${leagueId}/logo.${extension}`;
    } else {
      throw new HttpError('Choose a profile photo or a league logo');
    }

    const presigned = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: key,
      Expires: 60,
      Fields: {
        'Content-Type': contentType,
        // S3's default 204 has an empty body. Chrome reports that as "Failed to fetch"
        // on a cross-origin upload, so ask for a 201 with an XML body instead.
        success_action_status: '201',
      },
      Conditions: [
        ['content-length-range', 1, MAX_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
    });

    return {
      uploadUrl: presigned.url,
      fields: presigned.fields,
      imageUrl: `${baseUrl}/${key}?v=${Date.now()}`,
    };
  });
});
