
-- Allow operators to delete orders
CREATE POLICY "Operators can delete orders"
ON public.orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));

-- Allow operators to delete order items
CREATE POLICY "Operators can delete order items"
ON public.order_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));

-- Allow admins to delete order items (ALL policy already covers this, but explicit for clarity)
CREATE POLICY "Admins can delete order items"
ON public.order_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'main_admin'::app_role));
