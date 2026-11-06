// STUB: the real implementation is owned by the admin/store agent and replaces this file on merge.
// Contract: idempotent, acts on orders with status "paid".
export async function deliverOrder(orderId: string): Promise<{ ok: boolean; message?: string }> {
  void orderId;
  return { ok: false, message: "not implemented" };
}

export async function expireEntitlements(): Promise<{ expired: number }> {
  return { expired: 0 };
}
