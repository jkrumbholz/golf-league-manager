import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { LoadingService } from './loading.service';

const MAX_BYTES = 5 * 1024 * 1024;

interface UploadTicket {
  uploadUrl: string;
  fields: Record<string, string>;
  imageUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ImageService {
  constructor(private api: ApiService, private loading: LoadingService) {}

  uploadProfile(file: File): Promise<string> {
    return this.upload(file, { kind: 'profile' });
  }

  uploadLeagueLogo(file: File, leagueId: number): Promise<string> {
    return this.upload(file, { kind: 'leagueLogo', leagueId });
  }

  private upload(file: File, body: object): Promise<string> {
    return this.loading.track(this.sendUpload(file, body));
  }

  private async sendUpload(file: File, body: object): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Use a JPEG, PNG, or WebP image');
    if (file.size > MAX_BYTES) throw new Error('Images must be 5 MB or smaller');

    const ticket = await this.api.post<UploadTicket>('image', { ...body, contentType: file.type }, { quiet: true });
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) {
      form.append(name, value);
    }
    form.append('file', file);

    const response = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
    if (!response.ok) throw new Error('Could not upload the image');
    return ticket.imageUrl;
  }
}
