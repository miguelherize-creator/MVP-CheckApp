import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  BadRequestException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { StatementImportService } from '../services/statement-import.service';

export class ReclassifyDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  subcategory: string;
}

const MAX_PDF_SIZE_MB = 10;

@ApiTags('statement-imports')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('statement-imports')
export class StatementImportController {
  constructor(private readonly importService: StatementImportService) {}

  // POST /statement-imports/upload
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PDF_SIZE_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Solo se aceptan archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Subir cartola PDF — inicia clasificación automática' })
  async upload(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.importService.uploadAndParse(user.sub, file.buffer, file.originalname);
  }

  // GET /statement-imports
  @Get()
  @ApiOperation({ summary: 'Listar importaciones del usuario' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.importService.findAllByUser(user.sub);
  }

  // GET /statement-imports/:id
  @Get(':id')
  @ApiOperation({ summary: 'Estado de una importación' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.findOneByUser(id, user.sub);
  }

  // GET /statement-imports/:id/lines
  @Get(':id/lines')
  @ApiOperation({ summary: 'Todos los movimientos clasificados de una importación' })
  async getLines(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getLineItems(id, user.sub);
  }

  // GET /statement-imports/:id/lines/pending
  @Get(':id/lines/pending')
  @ApiOperation({ summary: 'Movimientos pendientes de revisión manual (sin categoría automática)' })
  async getPending(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getPendingLines(id, user.sub);
  }

  // PATCH /statement-imports/:id/lines/:lineId/reclassify
  @Patch(':id/lines/:lineId/reclassify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reclasificar manualmente un movimiento',
    description: 'El usuario corrige la categoría y subcategoría de un movimiento.',
  })
  async reclassify(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: ReclassifyDto,
  ) {
    return this.importService.reclassifyLine(id, lineId, user.sub, dto.category, dto.subcategory);
  }

  // DELETE /statement-imports/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una importación en curso' })
  async cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.cancelImport(id, user.sub);
  }
}
