class OneLayerStreamJSONParser:
    def __init__(self):
        self.current_key = ""
        self.current_val_chunk = ""
        self.in_key_quotes = False
        self.in_val = False
        self.in_val_bar = []
        self.end_var = False
        self.lstrip = False

    def pair_val_bar(self, ket: str) -> bool:
        if ket not in (",", "]", "}"):
            return False
        if not self.in_val_bar:
            return True

        count = 0
        i = len(self.in_val_bar) - 1
        while i >= 0 and self.in_val_bar[i] == '"':
            i -= 1
            count += 1

        if count % 2 == 1:
            return False

        if ket == ",":
            self.in_val_bar = self.in_val_bar[: i + 1]
            return len(self.in_val_bar) == 0

        bar = self.in_val_bar[i]
        if (bar == "[" and ket == "]") or (bar == "{" and ket == "}"):
            self.in_val_bar = self.in_val_bar[:i]
            return len(self.in_val_bar) == 0

        return False

    async def write(self, chunk: str) -> list[tuple[str, str]]:
        results = []
        for char in chunk:
            if self.lstrip:
                if char == " ":
                    continue
                else:
                    self.lstrip = False

            if self.in_val:
                if char == "," and len(self.in_val_bar) == 0:
                    self.end_var = True
                else:
                    if char in ('"', "[", "{"):
                        self.in_val_bar.append(char)
                        self.current_val_chunk += char
                    elif self.pair_val_bar(char):
                        self.end_var = True
                        if char != ",":
                            self.current_val_chunk += char
                    else:
                        self.current_val_chunk += char
            else:
                if char == '"':
                    self.in_key_quotes = not self.in_key_quotes
                    continue
                if self.in_key_quotes:
                    self.current_key += char
                elif char == ":":
                    self.in_val = True
                    self.lstrip = True
                    continue

            if self.end_var:
                results.append((self.current_key, self.current_val_chunk))
                self.current_val_chunk = ""
                self.current_key = ""
                self.end_var = False
                self.in_val = False

        if self.current_key and self.current_val_chunk:
            results.append((self.current_key, self.current_val_chunk))
            self.current_val_chunk = ""

        return results
