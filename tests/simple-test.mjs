import test from "ava";
import { iterableStringInterceptor } from "../src/iterable-string-interceptor";

async function* it(a) {
  for (const c of a) {
    yield c;
  }
}

async function* simpleTransformer(expression, remainder, source, cb) {
  yield `<<${expression}>>`;
}

async function* doubleTransformer(expression, remainder, source, cb) {
  yield "<<";
  yield expression;
  yield "-";
  yield expression;
  yield ">>";
}

async function collect(a) {
  const parts = [];
  for await (const c of a) {
    parts.push(c);
  }

  return parts.join("");
}

test("expressions within chunks", async t => {
  t.is(
    await collect(
      iterableStringInterceptor(
        it(["1{{aa}}2", "3{{bb}}4", "5{{cc}}67{{dd}}"]),
        simpleTransformer
      )
    ),
    "1<<aa>>23<<bb>>45<<cc>>67<<dd>>"
  );
});

test("expressions within chunks serveral transformed chunks", async t => {
  t.is(
    await collect(
      iterableStringInterceptor(
        it(["1{{aa}}2", "3{{bb}}4", "5{{cc}}67{{dd}}"]),
        doubleTransformer
      )
    ),
    "1<<aa-aa>>23<<bb-bb>>45<<cc-cc>>67<<dd-dd>>"
  );
});

test("expressions splitted between chunks", async t => {
  t.is(
    await collect(
      iterableStringInterceptor(
        it(["1{", "{a", "a}}2", "3{{bb}}4"]),
        simpleTransformer
      )
    ),
    "1<<aa>>23<<bb>>4"
  );
});

test("with ${ } lead -in/ -out", async t => {
  t.is(
    await collect(
      iterableStringInterceptor(
        it(["1${aa}2", "3${bb}4", "5${cc}67${dd}"]),
        simpleTransformer,
        "${",
        "}"
      )
    ),
    "1<<aa>>23<<bb>>45<<cc>>67<<dd>>"
  );
});

test("yielding several chunks", async t => {
  async function* transformer(expression) {
    for (let i = 0; i < 10; i++) {
      yield expression.toUpperCase();
    }
  }

  t.is(
    await collect(iterableStringInterceptor(it(["1{{b}}2"]), transformer)),
    "1BBBBBBBBBB2"
  );
});

test("double lead-in handeled by transformer", async t => {
  async function* transformer(
    expression,
    remainder,
    source,
    cb,
    leadIn,
    leadOut
  ) {
    const li = expression.indexOf(leadIn);
    if (li >= 0) {
      const lo = remainder.indexOf(leadOut, li);
      expression += leadOut + remainder.substring(0, lo);
      yield `<<${expression}>>`;

      cb(remainder.substring(lo + leadOut.length));
    } else {
      yield `<<${expression}>>`;
    }
  }

  t.is(
    await collect(
      iterableStringInterceptor(it(["1{{aa {{bb}} cc}}2"]), transformer)
    ),
    "1<<aa {{bb}} cc>>2"
  );
});
