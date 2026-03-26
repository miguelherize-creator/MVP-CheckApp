import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  async me(@CurrentUser() user: JwtPayload) {
    const u = await this.usersService.findById(user.sub);
    if (!u) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.usersService.toPublic(u);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Actualizar nombre o correo' })
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const u = await this.usersService.updateProfile(user.sub, dto);
    return this.usersService.toPublic(u);
  }

  @Patch('me/password')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cambiar contraseña (invalida sesiones previas)' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
