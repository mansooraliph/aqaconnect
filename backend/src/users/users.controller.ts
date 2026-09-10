import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../rbac/access-control.service';

@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @RequirePermission('system.users.view')
  async list(@CurrentUser() user: AuthenticatedUser) {
    const accessContext = await this.accessControl.getUserAccessContext(user.userId);
    return this.usersService.listForUser(accessContext);
  }

  @Post()
  @RequirePermission('system.users.manage')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @RequirePermission('system.users.view')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('system.users.manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/roles')
  @RequirePermission('system.users.manage')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermission('system.users.manage')
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    await this.usersService.resetPassword(id, dto);
    return { success: true };
  }
}
