import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ description: 'ID del plan a suscribir' })
  @IsUUID()
  planId: string;
}
