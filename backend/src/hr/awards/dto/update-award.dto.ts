import { IsEnum } from 'class-validator';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

// Award only has one mutable field post-creation (status, e.g. to revoke an
// award), so the update DTO is intentionally narrow rather than a PartialType
// of the create DTO.
export class UpdateAwardDto {
  @IsEnum(ActiveStatusDto)
  status: ActiveStatusDto;
}
