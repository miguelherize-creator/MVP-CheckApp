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
import { CreateFundingSourceDto } from '../dto/create-funding-source.dto';
import { UpdateFundingSourceDto } from '../dto/update-funding-source.dto';
import { FundingSourcesService } from '../services/funding-sources.service';

/** CRUD de orígenes de fondos (cuentas, tarjetas, etc.) */
@ApiTags('Orígenes de fondos')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('funding-sources')
export class FundingSourcesController {
  constructor(private readonly service: FundingSourcesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar orígenes de fondos del usuario' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un origen por id' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear origen de fondos' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFundingSourceDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar origen' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFundingSourceDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar origen' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.sub, id);
  }
}
