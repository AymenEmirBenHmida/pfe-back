import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, unlinkSync } from 'fs';
import * as path from 'path';

@Injectable()
export class ImageService {
  constructor(private configService: ConfigService) {}
  async deletImage(imagePath: string) {
    //delete the image
    console.log(imagePath);

    if (!imagePath) {
      return false;
    }
    const filename = path.basename(imagePath);
    console.log(filename);
    const uploadPath = this.configService.get('UPLOAD_PATH');
    if (!uploadPath) {
      return false;
    }
    const absoluteFilePath = path.join(process.cwd(), uploadPath, filename);
    console.log(absoluteFilePath);

    // Check if the file exists delete
    if (existsSync(absoluteFilePath)) {
      unlinkSync(absoluteFilePath);
      return true;
    }
    return false;
  }
}
