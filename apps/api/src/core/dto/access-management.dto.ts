import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';

const userStatuses = ['ACTIVE', 'DISABLED', 'LOCKED', 'PENDING'] as const;
const dataScopes = ['ALL', 'COMPANY', 'DEPARTMENT', 'DEPARTMENT_AND_CHILDREN', 'SELF', 'CUSTOM'] as const;

export class CreateUserDto {
  @IsString() @Matches(/^[a-zA-Z0-9._-]+$/) @MinLength(3) @MaxLength(50) username!: string;
  @IsOptional() @IsString() @MaxLength(50) employeeNo?: string;
  @IsString() @MinLength(1) @MaxLength(100) displayName!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== '') @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(100) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) remark?: string;
  @IsString() @MinLength(8) @MaxLength(100) password!: string;
  @IsOptional() @IsIn(userStatuses) status?: typeof userStatuses[number];
  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleIds!: string[];
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) orgUnitIds!: string[];
  @IsString() primaryOrgUnitId!: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(50) employeeNo?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) displayName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== '') @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(100) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) remark?: string;
  @IsOptional() @IsIn(userStatuses) status?: typeof userStatuses[number];
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleIds?: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) orgUnitIds?: string[];
  @IsOptional() @IsString() primaryOrgUnitId?: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(100) newPassword!: string;
  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
}

export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(100) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(100) newPassword!: string;
}

export class UpdateProfileDto {
  @IsString() @MinLength(1) @MaxLength(100) displayName!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== '') @IsEmail() @MaxLength(255) email?: string;
}

export class CreateRoleDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]*$/) @MinLength(2) @MaxLength(50) code!: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsIn(dataScopes) dataScope!: typeof dataScopes[number];
}

export class FieldPermissionDto {
  @IsString() @MinLength(1) @MaxLength(80) resource!: string;
  @IsString() @MinLength(1) @MaxLength(80) field!: string;
  @IsBoolean() canRead!: boolean;
  @IsBoolean() canWrite!: boolean;
}

export class UpdateRoleAccessDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsBoolean() active!: boolean;
  @IsIn(dataScopes) dataScope!: typeof dataScopes[number];
  @IsArray() @IsString({ each: true }) permissionIds!: string[];
  @IsArray() @IsString({ each: true }) menuIds!: string[];
  @IsArray() @IsString({ each: true }) customOrgUnitIds!: string[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => FieldPermissionDto) fieldPermissions!: FieldPermissionDto[];
}
