#!/bin/sh
# Run nvm's default node without sourcing nvm: ./run-node.sh script.ts [args]
v=$(sed 's/^v//' "$HOME/.nvm/alias/default" 2>/dev/null | head -n1)
d=$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sed 's/^v//' | grep -E "^$(echo "$v" | sed 's/\./\\./g')(\\.|\$)" \
  | sort -t. -k1,1n -k2,2n -k3,3n | tail -n1)
[ -n "$v" ] && [ -n "$d" ] || { echo "run-node.sh: cannot resolve nvm default '$v' to an installed node" >&2; exit 1; }
exec "$HOME/.nvm/versions/node/v$d/bin/node" "$@"
