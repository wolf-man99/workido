/** Shape of a chat message as the UI reads it. */
export interface ChatMessage {
  id: string;
  sender_id: string | null;
  message_type: "text" | "file" | "system";
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  attachment_duration_seconds: number | null;
  reply_to_id: string | null;
  proposal_id: string | null;
  contact_flagged: boolean;
  created_at: string;
}

export const MESSAGE_COLUMNS =
  "id, sender_id, message_type, body, attachment_path, attachment_name, attachment_type, attachment_size, attachment_duration_seconds, reply_to_id, proposal_id, contact_flagged, created_at";

/** Proposal as shown in the chat. */
export interface ProposalView {
  id: string;
  conversation_id: string;
  buyer_id: string;
  specialist_id: string;
  service_id: string | null;
  title: string;
  description: string;
  deliverables: string;
  price_minor: number;
  currency: string;
  delivery_time_hours: number;
  revisions_included: number;
  status: "pending" | "countered" | "accepted" | "declined" | "withdrawn";
  counter_price_minor: number | null;
  counter_delivery_time_hours: number | null;
  counter_note: string | null;
  counter_declined_at: string | null;
  accepted_terms: "original" | "counter" | null;
  expires_at: string;
  created_at: string;
  order: { id: string; order_number: string; status: string } | null;
}

export const PROPOSAL_COLUMNS =
  "id, conversation_id, buyer_id, specialist_id, service_id, title, description, deliverables, price_minor, currency, delivery_time_hours, revisions_included, status, counter_price_minor, counter_delivery_time_hours, counter_note, counter_declined_at, accepted_terms, expires_at, created_at, order:orders!orders_proposal_id_fkey(id, order_number, status)";

/** Open = still waiting on someone, and not past its expiry. */
export function isProposalOpen(proposal: Pick<ProposalView, "status" | "expires_at">, now = Date.now()): boolean {
  return (proposal.status === "pending" || proposal.status === "countered") && new Date(proposal.expires_at).getTime() > now;
}
