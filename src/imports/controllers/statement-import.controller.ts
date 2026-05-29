import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, BadRequestException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { StatementImportService } from '../services/statement-import.service';

export class ReclassifyDto {
  @IsString() @IsNotEmpty() category: string;
  @IsString() @IsNotEmpty() subcategory: string;
}

@ApiTags('statement-imports')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('statement-imports')
export class StatementImportController {
  constructor(private readonly importService: StatementImportService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false);
      cb(null, true);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Subir cartola PDF — inicia clasificación automática' })
  async upload(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió archivo');
    return this.importService.uploadAndParse(user.sub, file.buffer, file.originalname);
  }

  @Get()
  @ApiOperation({ summary: 'Listar importaciones del usuario' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.importService.findAllByUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado de una importación' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.findOneByUser(id, user.sub);
  }

  @Get(':id/lines')
  @ApiOperation({ summary: 'Todos los movimientos clasificados' })
  getLines(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getLineItems(id, user.sub);
  }

  @Get(':id/lines/pending')
  @ApiOperation({ summary: 'Movimientos sin categoría automática — pendientes de revisión' })
  getPending(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getPendingLines(id, user.sub);
  }

  @Patch(':id/lines/:lineId/reclassify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reclasificar manualmente un movimiento' })
  reclassify(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: ReclassifyDto,
  ) {
    return this.importService.reclassifyLine(id, lineId, user.sub, dto.category, dto.subcategory);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una importación en curso' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.cancelImport(id, user.sub);
  }
}
