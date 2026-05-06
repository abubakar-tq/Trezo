-- Add UPDATE policy so users can update their own ramp orders
-- Required for client-side mock fulfillment flow

create policy "Users can update their own ramp orders"
  on public.ramp_orders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
