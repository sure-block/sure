<script setup lang="ts">
import "vditor/dist/index.css";
import Vditor from "vditor";
import { useDark } from "@pureadmin/utils";
import { useIntervalFn } from "@vueuse/core";
import { onMounted, ref, watch, toRaw, onUnmounted } from "vue";
import { getToken, formatToken } from "@/utils/auth";

const emit = defineEmits([
  "update:modelValue",
  "after",
  "focus",
  "blur",
  "esc",
  "ctrlEnter",
  "select"
]);

const props = defineProps({
  options: {
    type: Object,
    default() {
      return {};
    }
  },
  modelValue: {
    type: String,
    default: ""
  }
});

const { isDark } = useDark();
const editor = ref<Vditor | null>(null);
const markdownRef = ref<HTMLElement | null>(null);
const editorReady = ref(false);
let pendingValue: string | null = null;

onMounted(() => {
  const token = getToken()?.accessToken;

  editor.value = new Vditor(markdownRef.value as HTMLElement, {
    ...props.options,
    value: props.modelValue,
    cache: {
      enable: false
    },
    fullscreen: {
      index: 10000
    },
    // 图片上传配置
    upload: {
      url: "/api/upload/image",
      headers: token
        ? {
            Authorization: formatToken(token)
          }
        : {},
      accept: "image/*",
      fieldName: "file",
      // 上传成功回调
      success(editor: Vditor, msg: string) {
        try {
          const res = JSON.parse(msg);
          if (res.url) {
            // 插入图片到编辑器
            editor.insertValue(`\n\n![image](${res.url})\n\n`);
          } else {
            console.error("[Vditor] 上传返回数据格式异常:", res);
          }
        } catch (e) {
          console.error("[Vditor] 解析上传响应失败:", e);
        }
      },
      // 上传失败回调
      fail(msg: string) {
        console.error("[Vditor] 图片上传失败:", msg);
        try {
          const res = JSON.parse(msg);
          if (res.error) {
            alert("图片上传失败：" + res.error);
          } else {
            alert("图片上传失败");
          }
        } catch {
          alert("图片上传失败：" + msg);
        }
      },
      // 上传错误回调
      error(err: any) {
        console.error("[Vditor] 图片上传错误:", err);
        alert("图片上传失败，请检查网络或权限");
      }
    },
    after() {
      editorReady.value = true;
      if (pendingValue !== null) {
        editor.value?.setValue(pendingValue);
        pendingValue = null;
      }
      emit("after", toRaw(editor.value));
    },
    input(value: string) {
      emit("update:modelValue", value);
    },
    focus(value: string) {
      emit("focus", value);
    },
    blur(value: string) {
      emit("blur", value);
    },
    esc(value: string) {
      emit("esc", value);
    },
    ctrlEnter(value: string) {
      emit("ctrlEnter", value);
    },
    select(value: string) {
      emit("select", value);
    }
  });
});

watch(
  () => props.modelValue,
  newVal => {
    if (!editorReady.value) {
      pendingValue = newVal;
      return;
    }
    if (newVal !== editor.value?.getValue()) {
      editor.value?.setValue(newVal);
    }
  }
);

watch(
  () => isDark.value,
  newVal => {
    const { pause } = useIntervalFn(() => {
      if (editor.value.vditor) {
        newVal
          ? editor.value.setTheme("dark", "dark", "rose-pine")
          : editor.value.setTheme("classic", "light", "github");
        pause();
      }
    }, 20);
  }
);

onUnmounted(() => {
  const editorInstance = editor.value;
  if (!editorInstance) return;
  try {
    editorInstance?.destroy?.();
  } catch (error) {
    console.log(error);
  }
});
</script>

<template>
  <div ref="markdownRef" />
</template>
