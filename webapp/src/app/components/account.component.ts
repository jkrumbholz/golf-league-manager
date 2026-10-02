import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService, SessionUser } from '../services/auth.service';
import { ImageService } from '../services/image.service';
import { ShellComponent } from '../ui/shell.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './account.component.html',
})
export class AccountComponent {
  firstName = '';
  lastName = '';
  displayName = '';
  handicapIndex = 0;
  profilePictureUrl = '';
  error = '';
  saved = false;
  uploading = false;
  pictureVisible = true;

  constructor(private api: ApiService, private auth: AuthService, private images: ImageService) {
    const user = this.auth.user();
    if (!user) return;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.displayName = user.displayName;
    this.handicapIndex = user.handicapIndex;
    this.profilePictureUrl = user.profilePictureUrl || '';
  }

  async save(): Promise<void> {
    this.error = '';
    this.saved = false;
    try {
      const result = await this.api.put<{ user: SessionUser }>('user', {
        firstName: this.firstName,
        lastName: this.lastName,
        displayName: this.displayName,
        handicapIndex: Number(this.handicapIndex),
        profilePictureUrl: this.profilePictureUrl,
      });
      this.auth.replaceUser(result.user);
      this.saved = true;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save';
    }
  }

  async onPicture(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error = '';
    this.saved = false;
    this.uploading = true;
    try {
      this.pictureVisible = true;
      this.profilePictureUrl = await this.images.uploadProfile(file);
      await this.save();
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not upload the photo';
    } finally {
      this.uploading = false;
    }
  }
}
