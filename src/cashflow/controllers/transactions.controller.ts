import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { TransactionsService } from '../services/transactions.service';

/** CRUD de movimientos / transacciones de flujo de caja */
@ApiTags('Transacciones')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar movimientos del usuario' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener movimiento por id' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear movimiento' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar movimiento' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar movimiento' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.sub, id);
  }
}
