import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateSubcategoryDto } from '../dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from '../dto/update-subcategory.dto';
import { SubcategoriesService } from '../services/subcategories.service';

/** CRUD de subcategorías ligadas a una categoría */
@ApiTags('Subcategorías')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly service: SubcategoriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar subcategorías (global + propias; filtro opcional por categoría)',
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.findAll(user.sub, categoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener subcategoría por id' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear subcategoría propia' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar subcategoría propia' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar subcategoría propia' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.sub, id);
  }
}
