import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persisted conversation reference used to send proactive messages.
 * One row per user (personal scope) so the bot never has to create the
 * conversation again after the first interaction or install.
 */
@Entity('conversation_references')
export class ConversationReferenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Microsoft Entra object id of the user. */
  @Column({ name: 'aad_object_id', unique: true })
  aadObjectId: string;

  /** Primary SMTP address of the user (resolved lazily via Graph when possible). */
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'service_url', type: 'text' })
  serviceUrl: string;

  @Column({ name: 'channel_id', default: 'msteams' })
  channelId: string;

  /** Bot id in the form "28:<app-id>". */
  @Column({ name: 'bot_id' })
  botId: string;

  @Column({ name: 'activity_id', type: 'varchar', nullable: true })
  activityId: string | null;

  /** True when the user opted out of proactive notifications. */
  @Column({ name: 'opt_out', default: false })
  optOut: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
