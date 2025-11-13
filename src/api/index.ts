import { Hono } from "hono";
import schema from "ponder:schema";
import { db } from "ponder:api";
import { graphql } from "ponder";

const app = new Hono();

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
