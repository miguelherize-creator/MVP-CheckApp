import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { FinancialProfileService } from '../services/financial-profile.service';
import { UpsertFinancialProfileDto } from '../dto/upsert-financial-profile.dto';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('profile')
export class FinancialProfileController {
  constructor(private readonly profileService: FinancialProfileService) {}

  @Get('financial')
  @ApiOperation({ summary: 'Obtener perfil financiero del usuario' })
  async getFinancialProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.profileService.findByUserId(user.sub);
    if (!profile) throw new NotFoundException('El perfil financiero aún no ha sido completado');
    return profile;
  }

  @Put('financial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Crear o actualizar el perfil financiero (upsert)' })
  async upsertFinancialProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertFinancialProfileDto,
  ) {
    return this.profileService.upsert(user.sub, dto);
  }
}
