
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"reason": string | null,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"reason"?: string | null,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"reason"?: string | null,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_actions_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_events": {
                  Row: {
                    "created_at": string,"event_name": string,"id": number,"properties": NonNullable<Json>,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_name": string,"id"?: never,"properties"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_name"?: string,"id"?: never,"properties"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"icon": string | null,"id": string,"is_active": boolean,"name": string,"parent_id": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"message": string,"name": string,"status": string,"topic": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"message": string,"name": string,"status"?: string,"topic": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"message"?: string,"name"?: string,"status"?: string,"topic"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_participants": {
                  Row: {
                    "conversation_id": string,"created_at": string,"last_read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"last_read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"last_read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": string,"last_message_at": string | null,"order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string | null,"order_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string | null,"order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"dispute_attachments": {
                  Row: {
                    "content_type": string,"created_at": string,"dispute_id": string,"filename": string,"id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_type": string,"created_at"?: string,"dispute_id": string,"filename": string,"id"?: string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "content_type"?: string,"created_at"?: string,"dispute_id"?: string,"filename"?: string,"id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispute_attachments_dispute_id_fkey"
      columns: ["dispute_id"]
isOneToOne: false
      referencedRelation: "disputes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispute_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"opened_by": string,"order_id": string,"outcome": Database["public"]['Enums']["dispute_outcome"] | null,"reason": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["dispute_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"opened_by": string,"order_id": string,"outcome"?: Database["public"]['Enums']["dispute_outcome"] | null,"reason": string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["dispute_status"]
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"opened_by"?: string,"order_id"?: string,"outcome"?: Database["public"]['Enums']["dispute_outcome"] | null,"reason"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["dispute_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_path": string | null,"attachment_size": number | null,"attachment_type": string | null,"body": string | null,"conversation_id": string,"created_at": string,"id": string,"message_type": Database["public"]['Enums']["message_type"],"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"attachment_size"?: number | null,"attachment_type"?: string | null,"body"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"message_type"?: Database["public"]['Enums']["message_type"],"sender_id"?: string | null
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"attachment_size"?: number | null,"attachment_type"?: string | null,"body"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"message_type"?: Database["public"]['Enums']["message_type"],"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"emailed_at": string | null,"id": string,"link_path": string | null,"read_at": string | null,"related_entity_id": string | null,"related_entity_type": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"link_path"?: string | null,"read_at"?: string | null,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"link_path"?: string | null,"read_at"?: string | null,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "created_at": string,"currency": string,"delivery_time_hours": number,"id": string,"message": string,"proposed_price_minor": number,"requirement_id": string,"responded_at": string | null,"revisions_included": number,"specialist_id": string,"status": Database["public"]['Enums']["offer_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"delivery_time_hours": number,"id"?: string,"message": string,"proposed_price_minor": number,"requirement_id": string,"responded_at"?: string | null,"revisions_included"?: number,"specialist_id": string,"status"?: Database["public"]['Enums']["offer_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"delivery_time_hours"?: number,"id"?: string,"message"?: string,"proposed_price_minor"?: number,"requirement_id"?: string,"responded_at"?: string | null,"revisions_included"?: number,"specialist_id"?: string,"status"?: Database["public"]['Enums']["offer_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"order_deliverables": {
                  Row: {
                    "content_type": string | null,"created_at": string,"description": string | null,"external_url": string | null,"filename": string,"id": string,"kind": string,"order_id": string,"size_bytes": number | null,"storage_path": string | null,"submission_id": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_type"?: string | null,"created_at"?: string,"description"?: string | null,"external_url"?: string | null,"filename": string,"id"?: string,"kind": string,"order_id": string,"size_bytes"?: number | null,"storage_path"?: string | null,"submission_id"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "content_type"?: string | null,"created_at"?: string,"description"?: string | null,"external_url"?: string | null,"filename"?: string,"id"?: string,"kind"?: string,"order_id"?: string,"size_bytes"?: number | null,"storage_path"?: string | null,"submission_id"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_deliverables_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_deliverables_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "order_submissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_deliverables_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"event_type": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"metadata": NonNullable<Json>,"order_id": string,"to_status": Database["public"]['Enums']["order_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type": string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"order_id": string,"to_status"?: Database["public"]['Enums']["order_status"] | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"order_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_submissions": {
                  Row: {
                    "created_at": string,"id": string,"message": string,"order_id": string,"submitted_by": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message": string,"order_id": string,"submitted_by": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string,"order_id"?: string,"submitted_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_submissions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_transitions": {
                  Row: {
                    "action": string,"actor": string,"from_status": Database["public"]['Enums']["order_status"],"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor": string,"from_status": Database["public"]['Enums']["order_status"],"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "action"?: string,"actor"?: string,"from_status"?: Database["public"]['Enums']["order_status"],"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    
                  ]
                },"orders": {
                  Row: {
                    "accepted_at": string | null,"buyer_brief": string | null,"buyer_fee_minor": number,"buyer_id": string,"cancellation_reason": string | null,"cancelled_at": string | null,"completed_at": string | null,"created_at": string,"currency": string,"delivery_deadline": string | null,"delivery_time_hours": number,"first_submitted_at": string | null,"id": string,"offer_id": string | null,"order_number": string,"paid_at": string | null,"payout_reference": string | null,"payout_status": Database["public"]['Enums']["payout_status"],"price_minor": number,"requirement_id": string | null,"revisions_included": number,"revisions_used": number,"scope_snapshot": NonNullable<Json>,"service_id": string | null,"source": string,"specialist_fee_minor": number,"specialist_id": string,"status": Database["public"]['Enums']["order_status"],"submitted_at": string | null,"title": string,"total_minor": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"buyer_brief"?: string | null,"buyer_fee_minor"?: number,"buyer_id": string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"currency": string,"delivery_deadline"?: string | null,"delivery_time_hours": number,"first_submitted_at"?: string | null,"id"?: string,"offer_id"?: string | null,"order_number"?: string,"paid_at"?: string | null,"payout_reference"?: string | null,"payout_status"?: Database["public"]['Enums']["payout_status"],"price_minor": number,"requirement_id"?: string | null,"revisions_included": number,"revisions_used"?: number,"scope_snapshot": NonNullable<Json>,"service_id"?: string | null,"source": string,"specialist_fee_minor"?: number,"specialist_id": string,"status"?: Database["public"]['Enums']["order_status"],"submitted_at"?: string | null,"title": string,"total_minor"?: never,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"buyer_brief"?: string | null,"buyer_fee_minor"?: number,"buyer_id"?: string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"currency"?: string,"delivery_deadline"?: string | null,"delivery_time_hours"?: number,"first_submitted_at"?: string | null,"id"?: string,"offer_id"?: string | null,"order_number"?: string,"paid_at"?: string | null,"payout_reference"?: string | null,"payout_status"?: Database["public"]['Enums']["payout_status"],"price_minor"?: number,"requirement_id"?: string | null,"revisions_included"?: number,"revisions_used"?: number,"scope_snapshot"?: NonNullable<Json>,"service_id"?: string | null,"source"?: string,"specialist_fee_minor"?: number,"specialist_id"?: string,"status"?: Database["public"]['Enums']["order_status"],"submitted_at"?: string | null,"title"?: string,"total_minor"?: never,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: true
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_webhook_events": {
                  Row: {
                    "error": string | null,"event_type": string,"id": string,"processed_at": string | null,"processing_status": string,"provider": string,"provider_event_id": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event_type": string,"id"?: string,"processed_at"?: string | null,"processing_status"?: string,"provider": string,"provider_event_id": string,"received_at"?: string
                  }
                  Update: {
                    "error"?: string | null,"event_type"?: string,"id"?: string,"processed_at"?: string | null,"processing_status"?: string,"provider"?: string,"provider_event_id"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"failure_reason": string | null,"id": string,"idempotency_key": string,"order_id": string,"provider": string,"provider_order_id": string,"provider_payment_id": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency": string,"failure_reason"?: string | null,"id"?: string,"idempotency_key": string,"order_id": string,"provider": string,"provider_order_id": string,"provider_payment_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"idempotency_key"?: string,"order_id"?: string,"provider"?: string,"provider_order_id"?: string,"provider_payment_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"portfolio_items": {
                  Row: {
                    "asset_path": string | null,"category_id": string | null,"created_at": string,"description": string | null,"external_url": string | null,"id": string,"sort_order": number,"specialist_id": string,"title": string,"visibility": Database["public"]['Enums']["visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_path"?: string | null,"category_id"?: string | null,"created_at"?: string,"description"?: string | null,"external_url"?: string | null,"id"?: string,"sort_order"?: number,"specialist_id": string,"title": string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Update: {
                    "asset_path"?: string | null,"category_id"?: string | null,"created_at"?: string,"description"?: string | null,"external_url"?: string | null,"id"?: string,"sort_order"?: number,"specialist_id"?: string,"title"?: string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolio_items_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_status": Database["public"]['Enums']["account_status"],"avatar_path": string | null,"bio": string | null,"city": string | null,"country_code": string | null,"created_at": string,"full_name": string,"id": string,"is_sample": boolean,"region": string | null,"updated_at": string,"username": string,"website_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_status"?: Database["public"]['Enums']["account_status"],"avatar_path"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string,"full_name": string,"id": string,"is_sample"?: boolean,"region"?: string | null,"updated_at"?: string,"username": string,"website_url"?: string | null
                  }
                  Update: {
                    "account_status"?: Database["public"]['Enums']["account_status"],"avatar_path"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"is_sample"?: boolean,"region"?: string | null,"updated_at"?: string,"username"?: string,"website_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"failure_reason": string | null,"id": string,"order_id": string,"payment_id": string,"processed_at": string | null,"provider_refund_id": string | null,"reason": string | null,"requested_by": string | null,"status": Database["public"]['Enums']["refund_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency": string,"failure_reason"?: string | null,"id"?: string,"order_id": string,"payment_id": string,"processed_at"?: string | null,"provider_refund_id"?: string | null,"reason"?: string | null,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["refund_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"order_id"?: string,"payment_id"?: string,"processed_at"?: string | null,"provider_refund_id"?: string | null,"reason"?: string | null,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["refund_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": string,"reporter_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": string,"reporter_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"requirement_attachments": {
                  Row: {
                    "content_type": string,"created_at": string,"filename": string,"id": string,"requirement_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_type": string,"created_at"?: string,"filename": string,"id"?: string,"requirement_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "content_type"?: string,"created_at"?: string,"filename"?: string,"id"?: string,"requirement_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirement_attachments_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirement_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"requirement_invitations": {
                  Row: {
                    "id": string,"invited_at": string,"requirement_id": string,"responded_at": string | null,"specialist_id": string,"status": Database["public"]['Enums']["invitation_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"invited_at"?: string,"requirement_id": string,"responded_at"?: string | null,"specialist_id": string,"status"?: Database["public"]['Enums']["invitation_status"]
                  }
                  Update: {
                    "id"?: string,"invited_at"?: string,"requirement_id"?: string,"responded_at"?: string | null,"specialist_id"?: string,"status"?: Database["public"]['Enums']["invitation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirement_invitations_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirement_invitations_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"requirement_matches": {
                  Row: {
                    "computed_at": string,"rank": number,"reasons": (string)[],"requirement_id": string,"score": number,"specialist_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"rank": number,"reasons"?: (string)[],"requirement_id": string,"score": number,"specialist_id": string
                  }
                  Update: {
                    "computed_at"?: string,"rank"?: number,"reasons"?: (string)[],"requirement_id"?: string,"score"?: number,"specialist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirement_matches_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirement_matches_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"requirement_skills": {
                  Row: {
                    "is_mandatory": boolean,"requirement_id": string,"skill_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "is_mandatory"?: boolean,"requirement_id": string,"skill_id": string
                  }
                  Update: {
                    "is_mandatory"?: boolean,"requirement_id"?: string,"skill_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirement_skills_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirement_skills_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "skills"
      referencedColumns: ["id"]
    }
                  ]
                },"requirements": {
                  Row: {
                    "budget_max_minor": number | null,"budget_min_minor": number | null,"buyer_id": string,"category_id": string | null,"closed_at": string | null,"created_at": string,"currency": string,"deadline_at": string | null,"deliverables": string | null,"description": string,"id": string,"location_preference": string | null,"preferred_experience": Database["public"]['Enums']["experience_level"] | null,"quantity": number | null,"reference_links": (string)[],"remote_ok": boolean,"revisions_expected": number | null,"status": Database["public"]['Enums']["requirement_status"],"subcategory_id": string | null,"submitted_at": string | null,"title": string,"updated_at": string,"urgency": Database["public"]['Enums']["urgency_level"]
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_max_minor"?: number | null,"budget_min_minor"?: number | null,"buyer_id": string,"category_id"?: string | null,"closed_at"?: string | null,"created_at"?: string,"currency"?: string,"deadline_at"?: string | null,"deliverables"?: string | null,"description"?: string,"id"?: string,"location_preference"?: string | null,"preferred_experience"?: Database["public"]['Enums']["experience_level"] | null,"quantity"?: number | null,"reference_links"?: (string)[],"remote_ok"?: boolean,"revisions_expected"?: number | null,"status"?: Database["public"]['Enums']["requirement_status"],"subcategory_id"?: string | null,"submitted_at"?: string | null,"title": string,"updated_at"?: string,"urgency"?: Database["public"]['Enums']["urgency_level"]
                  }
                  Update: {
                    "budget_max_minor"?: number | null,"budget_min_minor"?: number | null,"buyer_id"?: string,"category_id"?: string | null,"closed_at"?: string | null,"created_at"?: string,"currency"?: string,"deadline_at"?: string | null,"deliverables"?: string | null,"description"?: string,"id"?: string,"location_preference"?: string | null,"preferred_experience"?: Database["public"]['Enums']["experience_level"] | null,"quantity"?: number | null,"reference_links"?: (string)[],"remote_ok"?: boolean,"revisions_expected"?: number | null,"status"?: Database["public"]['Enums']["requirement_status"],"subcategory_id"?: string | null,"submitted_at"?: string | null,"title"?: string,"updated_at"?: string,"urgency"?: Database["public"]['Enums']["urgency_level"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirements_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirements_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirements_subcategory_id_fkey"
      columns: ["subcategory_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": string,"order_id": string,"rating": number,"reviewee_id": string,"reviewee_role": string,"reviewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"order_id": string,"rating": number,"reviewee_id": string,"reviewee_role"?: string,"reviewer_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"order_id"?: string,"rating"?: number,"reviewee_id"?: string,"reviewee_role"?: string,"reviewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewee_id_fkey"
      columns: ["reviewee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_specialists": {
                  Row: {
                    "buyer_id": string,"created_at": string,"specialist_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"created_at"?: string,"specialist_id": string
                  }
                  Update: {
                    "buyer_id"?: string,"created_at"?: string,"specialist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_specialists_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_specialists_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"services": {
                  Row: {
                    "buyer_instructions": string | null,"category_id": string,"created_at": string,"currency": string,"deliverables": string,"delivery_time_hours": number,"description": string,"id": string,"included_revisions": number,"moderation_note": string | null,"price_minor": number,"publication_status": Database["public"]['Enums']["publication_status"],"published_at": string | null,"slug": string,"specialist_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_instructions"?: string | null,"category_id": string,"created_at"?: string,"currency"?: string,"deliverables": string,"delivery_time_hours": number,"description": string,"id"?: string,"included_revisions"?: number,"moderation_note"?: string | null,"price_minor": number,"publication_status"?: Database["public"]['Enums']["publication_status"],"published_at"?: string | null,"slug"?: string,"specialist_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "buyer_instructions"?: string | null,"category_id"?: string,"created_at"?: string,"currency"?: string,"deliverables"?: string,"delivery_time_hours"?: number,"description"?: string,"id"?: string,"included_revisions"?: number,"moderation_note"?: string | null,"price_minor"?: number,"publication_status"?: Database["public"]['Enums']["publication_status"],"published_at"?: string | null,"slug"?: string,"specialist_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"skills": {
                  Row: {
                    "category_id": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"slug": string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "skills_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"specialist_categories": {
                  Row: {
                    "category_id": string,"created_at": string,"specialist_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"specialist_id": string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"specialist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialist_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specialist_categories_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"specialist_profiles": {
                  Row: {
                    "availability_status": Database["public"]['Enums']["availability_status"],"completed_orders_count": number,"created_at": string,"experience_level": Database["public"]['Enums']["experience_level"] | null,"headline": string | null,"is_published": boolean,"professional_bio": string | null,"published_at": string | null,"rating_avg": number | null,"rating_count": number,"updated_at": string,"user_id": string,"verification_status": Database["public"]['Enums']["verification_status"],"years_experience": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "availability_status"?: Database["public"]['Enums']["availability_status"],"completed_orders_count"?: number,"created_at"?: string,"experience_level"?: Database["public"]['Enums']["experience_level"] | null,"headline"?: string | null,"is_published"?: boolean,"professional_bio"?: string | null,"published_at"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"updated_at"?: string,"user_id": string,"verification_status"?: Database["public"]['Enums']["verification_status"],"years_experience"?: number | null
                  }
                  Update: {
                    "availability_status"?: Database["public"]['Enums']["availability_status"],"completed_orders_count"?: number,"created_at"?: string,"experience_level"?: Database["public"]['Enums']["experience_level"] | null,"headline"?: string | null,"is_published"?: boolean,"professional_bio"?: string | null,"published_at"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"updated_at"?: string,"user_id"?: string,"verification_status"?: Database["public"]['Enums']["verification_status"],"years_experience"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialist_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"specialist_skills": {
                  Row: {
                    "created_at": string,"skill_id": string,"specialist_id": string,"years_experience": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"skill_id": string,"specialist_id": string,"years_experience"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"skill_id"?: string,"specialist_id"?: string,"years_experience"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialist_skills_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "skills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specialist_skills_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "email_notifications": boolean,"marketing_emails": boolean,"phone": string | null,"updated_at": string,"user_id": string,"whatsapp_opt_in": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "email_notifications"?: boolean,"marketing_emails"?: boolean,"phone"?: string | null,"updated_at"?: string,"user_id": string,"whatsapp_opt_in"?: boolean
                  }
                  Update: {
                    "email_notifications"?: boolean,"marketing_emails"?: boolean,"phone"?: string | null,"updated_at"?: string,"user_id"?: string,"whatsapp_opt_in"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_requests": {
                  Row: {
                    "decision_note": string | null,"id": string,"message": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"specialist_id": string,"status": Database["public"]['Enums']["verification_status"],"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "decision_note"?: string | null,"id"?: string,"message"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"specialist_id": string,"status"?: Database["public"]['Enums']["verification_status"],"submitted_at"?: string
                  }
                  Update: {
                    "decision_note"?: string | null,"id"?: string,"message"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"specialist_id"?: string,"status"?: Database["public"]['Enums']["verification_status"],"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_specialist_id_fkey"
      columns: ["specialist_id"]
isOneToOne: false
      referencedRelation: "specialist_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_offer":
{ Args: { "p_offer_id": string }; Returns: string
                           },
"admin_mark_payout":
{ Args: { "p_order_id": string,"p_reference": string }; Returns: undefined
                           },
"admin_moderate_service":
{ Args: { "p_reason": string,"p_remove": boolean,"p_service_id": string }; Returns: undefined
                           },
"admin_platform_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_review_report":
{ Args: { "p_report_id": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           },
"admin_review_verification":
{ Args: { "p_approve": boolean,"p_note": string,"p_request_id": string }; Returns: undefined
                           },
"admin_search_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_role"?: Database["public"]['Enums']["app_role"],"p_status"?: Database["public"]['Enums']["account_status"] }; Returns: {
              "account_status": Database["public"]['Enums']["account_status"],"created_at": string,"email": string,"full_name": string,"id": string,"is_sample": boolean,"roles": (Database["public"]['Enums']["app_role"])[],"total_count": number,"username": string
            }[]
                           },
"admin_set_account_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: undefined
                           },
"apply_order_transition":
{ Args: { "p_action": string,"p_actor": string,"p_actor_user": string,"p_details"?: Json,"p_order_id": string }; Returns: {
              "accepted_at": string | null,
"buyer_brief": string | null,
"buyer_fee_minor": number,
"buyer_id": string,
"cancellation_reason": string | null,
"cancelled_at": string | null,
"completed_at": string | null,
"created_at": string,
"currency": string,
"delivery_deadline": string | null,
"delivery_time_hours": number,
"first_submitted_at": string | null,
"id": string,
"offer_id": string | null,
"order_number": string,
"paid_at": string | null,
"payout_reference": string | null,
"payout_status": Database["public"]['Enums']["payout_status"],
"price_minor": number,
"requirement_id": string | null,
"revisions_included": number,
"revisions_used": number,
"scope_snapshot": NonNullable<Json>,
"service_id": string | null,
"source": string,
"specialist_fee_minor": number,
"specialist_id": string,
"status": Database["public"]['Enums']["order_status"],
"submitted_at": string | null,
"title": string,
"total_minor": number | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_payment_failure":
{ Args: { "p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"apply_payment_success":
{ Args: { "p_payment_id": string,"p_provider_payment_id": string }; Returns: string
                           },
"apply_refund_failure":
{ Args: { "p_reason": string,"p_refund_id": string }; Returns: undefined
                           },
"apply_refund_success":
{ Args: { "p_provider_refund_id": string,"p_refund_id": string }; Returns: string
                           },
"become_specialist":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"calculate_fee_minor":
{ Args: { "p_amount_minor": number,"p_bps": number }; Returns: number
                           },
"can_access_requirement_files":
{ Args: { "p_requirement_id": string }; Returns: boolean
                           },
"can_review_order":
{ Args: { "p_order_id": string,"p_reviewee_id": string }; Returns: boolean
                           },
"can_upload_order_file":
{ Args: { "p_kind": string,"p_order_id": string }; Returns: boolean
                           },
"can_upload_requirement_files":
{ Args: { "p_requirement_id": string }; Returns: boolean
                           },
"create_service_order":
{ Args: { "p_brief": string,"p_service_id": string }; Returns: string
                           },
"current_user_is_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"decline_offer":
{ Args: { "p_offer_id": string }; Returns: undefined
                           },
"escape_like":
{ Args: { "p_value": string }; Returns: string
                           },
"get_match_candidates":
{ Args: { "p_requirement_id": string }; Returns: {
              "account_status": Database["public"]['Enums']["account_status"],"availability_status": Database["public"]['Enums']["availability_status"],"avatar_path": string,"cancellation_rate": number,"cancellation_sample": number,"category_ids": (string)[],"city": string,"completed_orders": number,"country_code": string,"experience_level": Database["public"]['Enums']["experience_level"],"full_name": string,"headline": string,"is_published": boolean,"is_sample": boolean,"min_delivery_any_hours": number,"min_delivery_in_category_hours": number,"min_price_any_minor": number,"min_price_in_category_minor": number,"on_time_rate": number,"on_time_sample": number,"portfolio_in_category": number,"portfolio_total": number,"rating_avg": number,"rating_count": number,"region": string,"service_category_ids": (string)[],"skill_ids": (string)[],"specialist_id": string,"username": string,"verification_status": Database["public"]['Enums']["verification_status"]
            }[]
                           },
"get_specialist_reputation":
{ Args: { "p_specialist_id": string }; Returns: {
              "cancellation_rate": number,"cancellation_sample": number,"completed_orders": number,"on_time_rate": number,"on_time_sample": number,"rating_avg": number,"rating_count": number,"repeat_clients": number
            }[]
                           },
"has_role":
{ Args: { "check_role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"is_direct_user_request":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_invited_to_requirement":
{ Args: { "req": string }; Returns: boolean
                           },
"is_order_participant":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"is_order_specialist":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"is_public_specialist":
{ Args: { "specialist": string }; Returns: boolean
                           },
"list_my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "conversation_id": string,"counterpart_avatar": string,"counterpart_id": string,"counterpart_name": string,"counterpart_username": string,"last_message_at": string,"last_message_body": string,"last_message_type": Database["public"]['Enums']["message_type"],"last_sender_id": string,"order_id": string,"order_number": string,"order_status": Database["public"]['Enums']["order_status"],"order_title": string,"unread_count": number
            }[]
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_notification_ids"?: (string)[] }; Returns: undefined
                           },
"mark_refund_processing":
{ Args: { "p_provider_refund_id": string,"p_refund_id": string }; Returns: undefined
                           },
"notification_email_outbox":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"created_at": string,"email": string,"email_enabled": boolean,"full_name": string,"link_path": string,"notification_id": string,"title": string,"type": string,"user_id": string
            }[]
                           },
"notify_user":
{ Args: { "p_body": string,"p_entity_id"?: string,"p_entity_type"?: string,"p_link_path": string,"p_title": string,"p_type": string,"p_user_id": string }; Returns: undefined
                           },
"open_dispute":
{ Args: { "p_description": string,"p_order_id": string,"p_reason": string }; Returns: string
                           },
"owns_requirement":
{ Args: { "req": string }; Returns: boolean
                           },
"perform_order_action":
{ Args: { "p_action": string,"p_note"?: string,"p_order_id": string }; Returns: {
              "accepted_at": string | null,
"buyer_brief": string | null,
"buyer_fee_minor": number,
"buyer_id": string,
"cancellation_reason": string | null,
"cancelled_at": string | null,
"completed_at": string | null,
"created_at": string,
"currency": string,
"delivery_deadline": string | null,
"delivery_time_hours": number,
"first_submitted_at": string | null,
"id": string,
"offer_id": string | null,
"order_number": string,
"paid_at": string | null,
"payout_reference": string | null,
"payout_status": Database["public"]['Enums']["payout_status"],
"price_minor": number,
"requirement_id": string | null,
"revisions_included": number,
"revisions_used": number,
"scope_snapshot": NonNullable<Json>,
"service_id": string | null,
"source": string,
"specialist_fee_minor": number,
"specialist_id": string,
"status": Database["public"]['Enums']["order_status"],
"submitted_at": string | null,
"title": string,
"total_minor": number | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"platform_fee_bps":
{ Args: { "p_key": string }; Returns: number
                           },
"refresh_specialist_completed_orders":
{ Args: { "p_specialist_id": string }; Returns: undefined
                           },
"refresh_specialist_rating":
{ Args: { "p_specialist_id": string }; Returns: undefined
                           },
"resolve_dispute":
{ Args: { "p_dispute_id": string,"p_outcome": Database["public"]['Enums']["dispute_outcome"],"p_resolution": string }; Returns: undefined
                           },
"search_services":
{ Args: { "p_availability"?: Database["public"]['Enums']["availability_status"],"p_category_slug"?: string,"p_limit"?: number,"p_max_delivery_hours"?: number,"p_max_price_minor"?: number,"p_min_price_minor"?: number,"p_min_rating"?: number,"p_offset"?: number,"p_query"?: string,"p_skill_slug"?: string,"p_sort"?: string,"p_specialist_id"?: string }; Returns: {
              "availability_status": Database["public"]['Enums']["availability_status"],"category_name": string,"category_slug": string,"cover_path": string,"currency": string,"delivery_time_hours": number,"included_revisions": number,"price_minor": number,"published_at": string,"rating_avg": number,"rating_count": number,"service_id": string,"slug": string,"specialist_avatar_path": string,"specialist_id": string,"specialist_is_sample": boolean,"specialist_name": string,"specialist_username": string,"title": string,"total_count": number,"verification_status": Database["public"]['Enums']["verification_status"]
            }[]
                           },
"search_specialists":
{ Args: { "p_availability"?: Database["public"]['Enums']["availability_status"],"p_category_slug"?: string,"p_experience"?: Database["public"]['Enums']["experience_level"],"p_limit"?: number,"p_max_starting_price_minor"?: number,"p_min_rating"?: number,"p_offset"?: number,"p_query"?: string,"p_skill_slug"?: string,"p_sort"?: string }; Returns: {
              "availability_status": Database["public"]['Enums']["availability_status"],"avatar_path": string,"city": string,"completed_orders_count": number,"currency": string,"experience_level": Database["public"]['Enums']["experience_level"],"full_name": string,"headline": string,"is_sample": boolean,"rating_avg": number,"rating_count": number,"skills": (string)[],"specialist_id": string,"starting_price_minor": number,"total_count": number,"username": string,"verification_status": Database["public"]['Enums']["verification_status"]
            }[]
                           },
"slugify":
{ Args: { "value": string }; Returns: string
                           },
"submit_verification_request":
{ Args: { "p_note"?: string }; Returns: string
                           },
"try_uuid":
{ Args: { "p_value": string }; Returns: string
                           }
          }
          Enums: {
            "account_status": "active"|"suspended","app_role": "buyer"|"specialist"|"admin","availability_status": "available"|"busy"|"unavailable","dispute_outcome": "complete_order"|"refund_buyer"|"resume_work","dispute_status": "open"|"resolved","experience_level": "entry"|"intermediate"|"expert","invitation_status": "invited"|"declined"|"offered","message_type": "text"|"file"|"system","offer_status": "pending"|"accepted"|"declined"|"withdrawn","order_status": "pending_payment"|"paid"|"in_progress"|"submitted"|"revision_requested"|"completed"|"cancelled"|"disputed"|"refund_pending"|"refunded","payment_status": "created"|"succeeded"|"failed"|"refunded","payout_status": "not_due"|"pending"|"paid_out"|"on_hold","publication_status": "draft"|"published"|"unpublished"|"removed","refund_status": "pending"|"processing"|"succeeded"|"failed","report_status": "open"|"reviewed"|"dismissed","report_target": "message"|"user"|"service","requirement_status": "draft"|"open"|"hired"|"closed","urgency_level": "flexible"|"standard"|"urgent","verification_status": "not_submitted"|"pending"|"verified"|"rejected","visibility": "public"|"hidden"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["active", "suspended"],"app_role": ["buyer", "specialist", "admin"],"availability_status": ["available", "busy", "unavailable"],"dispute_outcome": ["complete_order", "refund_buyer", "resume_work"],"dispute_status": ["open", "resolved"],"experience_level": ["entry", "intermediate", "expert"],"invitation_status": ["invited", "declined", "offered"],"message_type": ["text", "file", "system"],"offer_status": ["pending", "accepted", "declined", "withdrawn"],"order_status": ["pending_payment", "paid", "in_progress", "submitted", "revision_requested", "completed", "cancelled", "disputed", "refund_pending", "refunded"],"payment_status": ["created", "succeeded", "failed", "refunded"],"payout_status": ["not_due", "pending", "paid_out", "on_hold"],"publication_status": ["draft", "published", "unpublished", "removed"],"refund_status": ["pending", "processing", "succeeded", "failed"],"report_status": ["open", "reviewed", "dismissed"],"report_target": ["message", "user", "service"],"requirement_status": ["draft", "open", "hired", "closed"],"urgency_level": ["flexible", "standard", "urgent"],"verification_status": ["not_submitted", "pending", "verified", "rejected"],"visibility": ["public", "hidden"]
          }
        }
} as const
