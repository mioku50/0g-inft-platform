# Development Notes

This project uses the official 0G FineTuningServing contract deployed on the testnet.

Environment variables:

- `NEXT_PUBLIC_0G_RPC_URL` – RPC endpoint for 0G testnet.
- `OG_COMPUTE_PRIVATE_KEY` – private key of the wallet used for transactions.
- `NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS` – address of the FineTuningServing contract (`0xda478Ccf5d534346A16b1475E4c2DecE0268B176`).
- `NEXT_PUBLIC_FINE_TUNE_PROVIDER` – official fine tuning provider address (`0xf07240Efa67755B5311bc75784a061eDB47165Dd`).

### Basic workflow

1. Start dev server:
   ```bash
   pnpm --filter ./web dev
   ```
2. Use `/api/compute/account` to create or deposit to your fine‑tuning account:
   ```bash
   curl -X POST http://localhost:3000/api/compute/account \
        -H 'content-type: application/json' \
        -d '{"amount":"0.01","action":"create"}'
   ```
3. Check status with:
   ```bash
   curl http://localhost:3000/api/compute/account
   ```

Fine‑tuning tasks run against the address and provider above.
