import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { LoadingService } from './loading.service';

const MAX_BYTES = 5 * 1024 * 1024;

interface UploadTicket {
  uploadUrl: string;
  fields: Record<string, string>;
  imageUrl: string;
}

interface PreparedPhoto {
  blob: Blob;
  type: string;
  name: string;
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
    const photo = await this.prepare(file);
    const ticket = await this.api.post<UploadTicket>('image', { ...body, contentType: photo.type }, { quiet: true });
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) {
      form.append(name, value);
    }
    form.append('file', photo.blob, photo.name);
    const started = Date.now();
    try {
      await this.postForm(ticket.uploadUrl, form);
    } catch (error) {
      // iPhone Safari often rejects S3's reply after the file is already stored.
      if (await this.arrived(ticket.imageUrl, started)) return ticket.imageUrl;
      throw error;
    }
    return ticket.imageUrl;
  }

  private async arrived(url: string, started: number): Promise<boolean> {
    for (const wait of [0, 400, 1200]) {
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      try {
        const response = await fetch(url, { cache: 'no-store' });
        const type = response.headers.get('content-type') || '';
        const modified = Date.parse(response.headers.get('last-modified') || '');
        if (response.ok && type.startsWith('image/') && Number.isFinite(modified) && modified >= started - 15000) {
          return true;
        }
      } catch {
        // The next attempt may see the object once storage has caught up.
      }
    }
    return false;
  }

  /** iPhone library photos are often HEIC, unlabeled, or larger than the upload limit. */
  private async prepare(file: File): Promise<PreparedPhoto> {
    const type = this.canonicalType(file);
    const direct = type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
    if (direct && file.size > 0 && file.size <= MAX_BYTES) {
      return { blob: file, type, name: file.name || 'photo.jpg' };
    }
    let blob = await this.toJpeg(file, 1600, 0.85);
    if (blob.size > MAX_BYTES) blob = await this.toJpeg(file, 1280, 0.7);
    if (blob.size > MAX_BYTES) throw new Error('Images must be 5 MB or smaller');
    return { blob, type: 'image/jpeg', name: 'photo.jpg' };
  }

  private canonicalType(file: File): string {
    const type = file.type.toLowerCase();
    if (type === 'image/jpg' || type === 'image/pjpeg') return 'image/jpeg';
    return type;
  }

  private toJpeg(file: File, maxEdge: number, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error('Could not read that photo'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) reject(new Error('Could not read that photo'));
          else resolve(blob);
        }, 'image/jpeg', quality);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that photo'));
      };
      image.src = url;
    });
  }

  private postForm(url: string, form: FormData): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', url);
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        const message = /<Message>([^<]+)<\/Message>/.exec(request.responseText)?.[1];
        reject(new Error(message || 'Could not upload the image'));
      };
      request.onerror = () => reject(new Error('Could not upload the image'));
      request.send(form);
    });
  }
}
