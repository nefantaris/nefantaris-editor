const NON_WEBP_IMAGE_PATTERN = /\.(png|jpe?g|gif|bmp)$/i;

function findNonWebpImage(value) {
  if (typeof value !== "string") {
    return null;
  }

  for (const token of value.split(/[\s,]+/)) {
    const path = token.split(/[?#]/)[0];
    if (NON_WEBP_IMAGE_PATTERN.test(path)) {
      return token;
    }
  }

  return null;
}

const preferWebpImages = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer WebP images over PNG/JPEG/GIF/BMP for smaller file sizes and faster page loads",
    },
    messages: {
      preferWebp:
        'Image "{{path}}" is not WebP. Convert it at https://tools.sturge.dev/webp',
    },
    schema: [],
  },
  create(context) {
    function check(node, value) {
      const match = findNonWebpImage(value);
      if (match) {
        context.report({
          node,
          messageId: "preferWebp",
          data: { path: match },
        });
      }
    }

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.quasis.length === 1) {
          check(node, node.quasis[0].value.cooked);
        }
      },
    };
  },
};

export default {
  rules: {
    "prefer-webp-images": preferWebpImages,
  },
};
