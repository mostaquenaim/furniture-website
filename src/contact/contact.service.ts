import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  private submissions = [];

  submit(dto: CreateContactDto) {
    console.log('Contact submission received with dto:', dto);
    // const entry = { id: Date.now(), ...dto, createdAt: new Date() };
    // this.submissions.push(entry);
    // return entry;
  }

  getAll() {
    return this.submissions;
  }
}
