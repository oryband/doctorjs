// evalExp/CALL: args throw
function test(expected) {
  function t() {throw new Error("asdfaafs");}

  function id(x) {return x;}
  
  try {
    id(t());
  }
  catch (e) {
    return e.message;
  }
}

test(String(""));
