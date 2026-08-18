import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  private submissions = [];

  submit(dto: CreateContactDto) {}

  getAll() {
    return this.submissions;
  }
}
