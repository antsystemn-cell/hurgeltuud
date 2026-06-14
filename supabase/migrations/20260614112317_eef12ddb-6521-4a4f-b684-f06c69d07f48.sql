CREATE POLICY "Authenticated can view delivery proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-proofs');

CREATE POLICY "Authenticated can upload delivery proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-proofs');