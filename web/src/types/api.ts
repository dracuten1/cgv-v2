/**
 * API Data Transfer Objects (DTOs)
 * Verified against Go domain models in api/internal/model/*.go,
 * api/internal/handler/*.go, api/internal/repository/*.go
 */

// Error envelope matching model.ErrorEnvelope and fallback shapes
export interface ApiErrorPayload {
  success?: boolean;
  error?: string;
  code?: string;
  message?: string;
}

// User and Auth models (api/internal/model/user.go & api/internal/auth/model.go)
export interface User {
  id: string;
  display_name: string;
  is_demo: boolean;
  member_id?: string | null;
  created_at: string;
}

export interface UserIdentity {
  id: string;
  user_id: string;
  provider: 'zalo' | 'google' | 'facebook' | 'email' | 'demo' | 'mock' | string;
  provider_subject: string;
  linked_at: string;
  last_login_at: string;
}

export interface ContactPoint {
  id: string;
  user_id: string;
  kind: 'email' | 'phone';
  value: string;
  verified: boolean;
  verified_via?: string | null;
  created_at: string;
}

export interface UserProfile {
  User: User;
  Identities: UserIdentity[];
  Contacts: ContactPoint[];
}

export interface ProviderInfo {
  id: string;
  name: string;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
}

export interface AuthSessionResponse {
  user: User;
  is_new: boolean;
  conflict_detected: boolean;
}

export interface MessageResponse {
  message: string;
}

// Genealogy models (api/internal/model/family.go & member.go)
export interface Family {
  id: string;
  name: string;
  version: number;
  created_at: string;
}

export interface FamiliesResponse {
  families: Family[];
}

export type Gender = 'male' | 'female';

export interface Member {
  id: string;
  family_id: string;
  full_name: string;
  gender: Gender;
  generation_index: number;
  birth_date?: string | null;
  death_date?: string | null;
  is_living: boolean;
  avatar_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface TreeNode {
  id: string;
  full_name: string;
  gender: Gender;
  generation_index: number;
  birth_date?: string | null;
  death_date?: string | null;
  is_living: boolean;
  avatar_url?: string;
  spouse_ids?: string[];
  children?: TreeNode[];
}

export interface GenerationMeta {
  index: number;
  label: string;
  count: number;
}

export interface TreeResponse {
  family_id: string;
  version: number;
  generations: GenerationMeta[];
  roots: TreeNode[];
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MemberInput {
  family_id: string;
  full_name: string;
  gender: string; // 'nam'/'nữ' or 'male'/'female'
  generation_index?: number;
  birth_date?: string | null;
  death_date?: string | null;
  is_living?: boolean | null;
  avatar_url?: string | null;
  notes?: string | null;
  parent_ids?: string[];
  spouse_ids?: string[];
}

export interface MemberRelations {
  parents: Member[];
  children: Member[];
  siblings: Member[];
  spouses: Member[];
}

export interface MemberDetailResponse {
  id: string;
  family_id: string;
  full_name: string;
  gender: Gender;
  generation_index: number;
  birth_date?: string | null;
  death_date?: string | null;
  is_living: boolean;
  avatar_url?: string | null;
  notes?: string | null;
  created_at: string;
  family_name: string;
  relations: MemberRelations;
  posts: FeedPost[];
}

// Kinship (api/internal/model/kinship.go)
export interface KinshipResult {
  term: string;
  line: 'Chi nội' | 'Chi ngoại' | 'Hôn phối' | 'Đồng tông' | string;
  generation_distance: number;
  distance_label: string;
  is_blood: boolean;
  dialect: 'bac' | 'trung' | 'nam' | string;
  path: string[];
}

// Batched kinship labels (Decision 2C, GET /api/v1/families/:id/kinship-labels).
// One flat dictionary of memberID → Vietnamese kinship term relative to `from`.
export interface KinshipLabelsResponse {
  family_id: string;
  from: string;
  dialect: string;
  labels: Record<string, string>;
}

// Feed (api/internal/model/post.go & api/internal/handler/feed_handler.go)
export interface FeedPost {
  id: string;
  family_id: string;
  author_member_id?: string | null;
  content: string;
  images: string[];
  created_at: string;
}

export interface FeedPostItem extends FeedPost {
  author_display_name: string;
}

export interface FeedCursor {
  created_at: string;
  id: string;
}

export interface FeedListResponse {
  posts: FeedPostItem[];
  next_cursor?: FeedCursor | null;
}

export interface CreatePostInput {
  content: string;
  images?: string[];
}

// Excel (api/internal/excel/service.go)
export interface ImportSummary {
  created: number;
  skipped_duplicates: number;
  errors?: string[];
}

// Push (api/internal/model/push.go & api/internal/handler/push_handler.go)
export interface PushSubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Health (api/internal/handler/health_handler.go)
export interface HealthResponse {
  status: 'ok' | 'error' | string;
  db: 'up' | 'down' | string;
  version: string;
  time: string;
  error?: ApiErrorPayload;
}
