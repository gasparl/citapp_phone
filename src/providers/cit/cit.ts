// this file contains the CIT mechanism (task, responses, etc.)

import { Injectable } from '@angular/core';
import { BackgroundMode } from '@ionic-native/background-mode';
import { File } from '@ionic-native/file';
import { NavigationBar } from '@ionic-native/navigation-bar';
import { TranslationProvider } from '../../providers/translations/translations';
import { ItemgenProvider } from '../../providers/itemgen/itemgen';
import { StatusBar } from '@ionic-native/status-bar';
import { DataShareProvider } from '../../providers/data-share/data-share';

@Injectable()
export class CitProvider {
  content: any;

  /*
  // the function below simulates keypresses for testing
  touchsim() {
    var info = this.trial_stim.type + " (" + this.trial_stim.item + ")";
    var rt_sim = this.itemgenP.randomdigit(600, 830);
    var correct_chance, sim_key, corr_code, incor_code, chosen_response;
    setTimeout(function() {
      if (this.crrnt_phase === 'practice_strict') {
        correct_chance = 1;
      } else if (this.crrnt_phase === 'main') {
        correct_chance = 0.5;
      } else {
        correct_chance = 0.9;
      }
      if (this.correct_resp == "resp_a") {
        corr_code = "resp_a";
        incor_code = "resp_b";
      } else {
        corr_code = "resp_b";
        incor_code = "resp_a";
      }
      if (Math.random() < correct_chance) { // e.g. 95% correctly right key
        sim_key = corr_code;
      } else {
        sim_key = incor_code;
      }
      if (sim_key == "resp_a") {
        chosen_response = "Response: resp_a (LEFT)";
      } else {
        chosen_response = "Response: resp_b (RIGHT)";
      }
      info += "\n--len(stims): " + this.teststim.length + ", trialnum: " + this.block_trialnum + "\n";
      this.touchstart("", sim_key);
      info += chosen_response + " preset " + rt_sim + ", actual " + Math.round(performance.now() - this.start) + "\n";
      console.log(info);
    }.bind(this), rt_sim);
  }
  //*/
  to_slice: number = 0; // 0 to skip

  subj_id: string = '';
  current_div: string = "div_start"; // ddd default: "div_start", div_settings, div_dems, div_cit_main, div_end
  current_segment: string = 'main'; // initial menu to be displayed in the interface
  current_menu: string = '';
  false_delay: number = 400; // duration of "Wrong" message
  tooslow_delay: number = 400; // duration of "Too Slow" message
  isi_delay_minmax: number[] = [300, 700]; // min/max of ISI, in ms
  response_timelimit: number;
  response_timelimit_main: number = 1000; // time limit in the main task, in ms
  isi_delay: number = 99999;
  cit_type: any = 0; // default CIT type (according to cittypedict)
  cittypedict: any = {
    '0': 'enhanced',
    '1': 'standard',
    '2': 'notarget'
  };
  bg_color: string = "#fff"; // background color during CIT
  feed_text: string = "";
  visib: any = { start_text: true };
  block_texts: string[];
  teststim: any[];
  tooslow: number;
  incorrect: number;
  block_trialnum: number;
  rt_data_dict: any;
  all_rts: object = {
    "probe1": [],
    "probe2": [],
    "probe3": [],
    "probe4": [],
    "probe5": [],
    "targetflr": [],
    "nontargflr": [],
    "target": []
  };
  trial_stim: any;
  rspns: string;
  no_prac_fail: boolean = true;
  text_to_show: string;
  cit_data: string;
  correct_resp: string = "none";
  blocknum: number;
  num_of_blocks: any = 1;
  rt_start: number = 99999;
  rt_end: number = 99999;
  start: any = 0;
  listen: boolean = false;
  listn_end: boolean = false;
  response_window: any;
  stim_base: any[];
  the_targets: string[];
  the_nontargs: string[];
  the_probes: string[];
  stimulus_text: string = "";
  to_display: string = "";
  targetrefs: object[];
  nontargrefs: object[];
  path: any = "(path not found)";
  consented: number;
  crrnt_phase: string;
  canvas;
  ctx;
  task_images: object;
  image_width: number;
  all_teststms: any[] = [];

  constructor(
    public file: File,
    public navigationBar: NavigationBar,
    public statusBar: StatusBar,
    public backgroundMode: BackgroundMode,
    public trP: TranslationProvider,
    public dataShare: DataShareProvider,
    public itemgenP: ItemgenProvider
  ) { }

  // switching pages
  pointev: any = {};
  switch_divs(div_to_show, goto = false) {
    this.current_div = div_to_show;
    Object.keys(this.pointev).forEach(ky => this.pointev[ky] = "none");
    setTimeout(() => {
      this.pointev[div_to_show] = "auto";
      if (goto == true) {
        this.current_menu = 'm_prevs';
        this.current_segment = 'menus';
        this.content.scrollToTop(0);
      }
    }, 300);
    this.navigationBar.hideNavigationBar();
    this.statusBar.hide();
    this.content.resize();
    this.content.scrollToTop(0);
  }

  // starting the CIT
  task_start() {
    this.backgroundMode.setDefaults({
      text: "Test in progress!",
      silent: false
    })
    this.itemgenP.stim_base_p = JSON.parse(JSON.stringify(this.stim_base));
  }

  // formatting list of items in the instructions into a comma-separated text
  list_items(dicts) {
    let textitems = dicts.filter(dct => dct.mode === 'text').map(dct => {
      return '<li>' + dct.item + '</li>';
    }).sort().join('<br>');
    let imgitems = dicts.filter(dct => dct.mode === 'image').map(dct => {
      let props = 'style="max-height:50%;max-width:50%;vertical-align: middle;"';
      return '<li><img ' + props + ' src="' + this.task_images[dct.item].src + '"></li>';
    }).sort().join('<br>');
    if (textitems.length > 0 && imgitems.length > 0) {
      return '<b><ul>' + textitems + '<br>' + imgitems + '</ul></b><br>';
    } else {
      return '<b><ul>' + textitems + imgitems + '</ul></b><br>';
    }
  }

  // setting the block texts in the specific language
  set_block_texts() {
    let trefs = this.list_items(this.targetrefs);
    let nontrefs = this.list_items(this.nontargrefs);
    let targs = this.list_items(this.the_targets);
    let nontargs = this.list_items(this.the_nontargs);
    this.block_texts = this.trP.blck_texts[this.trP.lang](targs, nontargs, trefs, nontrefs, this.cit_type);
    this.block_text = this.block_texts[1];
  }

  //capitalize texts
  capitalize(str1) {
    return str1.charAt(0).toUpperCase() + str1.slice(1);
  }

  //calculate sum
  sum(array_to_sum) {
    var sum = 0;
    array_to_sum.forEach(function(item) {
      sum += item;
    });
    return sum;
  }
  //calculate mean
  mean(array_to_avg) {
    var mean = this.sum(array_to_avg) / array_to_avg.length;
    return mean;
  }

  //calculate sd
  sd(array_for_sd) {
    var m = this.mean(array_for_sd);
    return Math.sqrt(array_for_sd.reduce(function(sq, n) {
      return sq + Math.pow(n - m, 2);
    }, 0) / (array_for_sd.length - 1));
  };

  //calculate pooled sd
  sd_pooled(var1, var2) {
    let n1 = var1.length
    let n2 = var2.length
    let nom = (n1 - 1) * (this.sd(var1) ** 2) + (n2 - 1) * (this.sd(var2) ** 2)
    return Math.sqrt(nom / (n1 + n2 - 2))
  }

  // neatly formatted current date
  neat_date() {
    var m = new Date();
    return m.getFullYear() + "" +
      ("0" + (m.getMonth() + 1)).slice(-2) + "" +
      ("0" + m.getDate()).slice(-2) + "" +
      ("0" + m.getHours()).slice(-2) + "" +
      ("0" + m.getMinutes()).slice(-2) + "" +
      ("0" + m.getSeconds()).slice(-2);
  }

  // showing "Too slow"
  flash_too_slow() {
    this.feed_text = this.trP.feedtooslo[this.trP.lang];
    setTimeout(function() {
      this.feed_text = "";
      this.tooslow = 1;
      this.rspns = "x";
      this.prac_fail();
      this.post_resp_hold();
    }.bind(this), this.tooslow_delay);
  }

  // showing "Wrong"
  flash_false() {
    this.feed_text = this.trP.feedwrong[this.trP.lang];
    setTimeout(function() {
      this.feed_text = "";
      this.incorrect = 1;
      this.prac_fail();
      this.post_resp_hold();
    }.bind(this), this.false_delay);
  }

  // practice task interruption after no correct response ("strict practice")
  prac_fail() {
    if (this.crrnt_phase === 'practice_strict') {
      this.teststim = [];
      this.no_prac_fail = false;
    }
  }

  // displaying ISI (empty screen) before item display
  isi() {
    this.isi_delay = this.itemgenP.randomdigit(1, this.isi_delay_minmax[1] - this.isi_delay_minmax[0]);
    setTimeout(function() {
      this.item_display();
    }.bind(this), this.isi_delay);
  }

  // evaluation of practice task: whether it needs repetition
  prac3_rep: number;
  practice_eval() {
    let min_ratio;
    var is_valid = true;
    var types_failed = [];
    if (this.crrnt_phase === 'practice_strict') {
      is_valid = this.no_prac_fail;
      this.no_prac_fail = true;
      if (is_valid == false) {
        this.block_text = '<span></span>' +
          this.trP.accrep_feed[this.trP.lang];
      }
    } else {
      if (this.blocknum === 3) {
        if (this.prac3_rep == 0) {
          this.prac3_rep++;
        } else {
          return true;
        }
        min_ratio = 0.4
      } else {
        min_ratio = 0.8
      }
      for (var it_type in this.rt_data_dict) {
        var rts_correct = this.rt_data_dict[it_type].filter(function(rt_item) {
          return rt_item >= 150;
        });
        var corr_ratio = rts_correct.length / this.rt_data_dict[it_type].length;
        if (corr_ratio < min_ratio) {
          is_valid = false;
          types_failed.push(
            " " +
            this.trP.it_type_feed_dict[this.trP.lang][it_type] +
            " (" +
            Math.floor(corr_ratio * 100) +
            this.trP.correct[this.trP.lang] + ')'
          );
        }
      }
      if (is_valid == false) {
        this.block_text = '<span></span>' +
          this.trP.acc_feed[this.trP.lang][0] + min_ratio * 100 + this.trP.acc_feed[this.trP.lang][1] +
          types_failed.join(",") +
          ".";
      }
    }
    return is_valid;
  }

  // initiate next block's trials
  start_trials() {
    setTimeout(function() {
      this.next_trial()
    }.bind(this), this.isi_delay_minmax[0]);
  }

  block_text: string = '';

  // run next trial if available, otherwise set up next block
  next_trial() {
    if (this.teststim.length > 0) {
      this.tooslow = 0;
      this.incorrect = 0;
      this.rt_start = 99999;
      this.rt_end = 99999;
      this.rspns = "";
      this.trial_stim = this.teststim.shift();
      this.block_trialnum++;
      this.text_to_show = this.trial_stim.item;
      this.isi();
    } else {
      // if practice task, check for sufficient correct responses via practice_eval()
      // go to next block if passed, otherwise give feedback and repeat
      if ((this.blocknum > 3) || (this.blocknum > 2 && this.cit_type !== 0) || this.practice_eval()) {
        this.blocknum++;
        if (this.blocknum <= (this.num_of_blocks + 2) ||
          (this.cit_type === 0 && this.blocknum <= (this.num_of_blocks + 3))) {
          if (this.block_texts[this.blocknum] !== undefined) {
            this.block_text = this.block_texts[this.blocknum];
            this.nextblock();
          } else {
            this.block_trialnum = 0;
            this.teststim = this.all_teststms.shift();
            if (this.to_slice !== 0) {
              this.teststim = this.teststim.slice(0, this.to_slice);
            }
            this.next_trial();
          }
        } else {
          this.bg_color = "#fff";
          this.switch_divs('div_end')
          this.store_data();
          this.backgroundMode.setDefaults({
            silent: true
          })
        }
      } else {
        this.nextblock();
      }
    }
  }

  // wait after response to potentially record press release ("keyup")
  post_resp_hold() {
    this.ctx.clearRect(0, 0, this.image_width, this.image_width);
    this.stimulus_text = "";
    setTimeout(function() {
      this.listn_end = false;
      this.add_response();
    }.bind(this), this.isi_delay_minmax[0]);
  }

  // save all trial details in a new line and store RT in rt_data_dict for evaluation later
  add_response() {
    var curr_type;
    var act_type = this.trial_stim.type.replace(/[0-9]$/, '');
    if (
      ["targetflr", "nontargflr", "target"].indexOf(act_type) >= 0
    ) {
      curr_type = act_type;
    } else {
      curr_type = "main_item";
    }
    if (!(curr_type in this.rt_data_dict)) {
      this.rt_data_dict[curr_type] = [];
    }
    if (this.incorrect == 1 || this.tooslow == 1) {
      this.rt_data_dict[curr_type].push(-1);
    } else {
      this.rt_data_dict[curr_type].push(this.rt_start);
    }
    if (
      ["targetflr", "nontargflr", "target"].indexOf(act_type) === -1
    ) {
      curr_type = this.trial_stim.type;
    }
    // too fast: -2; too slow: -1; incorrect: 0
    if (this.crrnt_phase == 'main') {
      if (this.rt_start > this.response_timelimit_main) {
        this.tooslow = 1;
      }
      if (this.rt_start < 150) {
        this.all_rts[curr_type].push(-2);
      } else if (this.tooslow === 1) {
        this.all_rts[curr_type].push(-1);
      } else if (this.incorrect === 1) {
        this.all_rts[curr_type].push(0);
      } else {
        this.all_rts[curr_type].push(this.rt_start);
      }
    }
    this.cit_data +=
      [this.subj_id,
      this.cittypedict[this.cit_type],
      this.crrnt_phase,
      this.blocknum,
      this.block_trialnum,
      this.trial_stim.item,
      this.trial_stim.cat,
      this.trial_stim.type,
      this.rspns,
      this.rt_start,
      this.rt_end - this.rt_start,
      this.incorrect,
      this.tooslow,
      (this.isi_delay + this.isi_delay_minmax[0]),
      String(new Date().getTime())
      ].join('\t') +
      "\n";
    this.next_trial();
  }

  // set up the settings of the upcoming block and display related instructions
  nextblock() {
    this.crrnt_phase = 'practice';
    this.bg_color = "#fff";
    this.block_trialnum = 0;
    // 0: fillers & target, 1: standard CIT, 2: fillers (no target)
    if (this.blocknum == 1) {
      this.prac3_rep = 0;
      if (this.cit_type === 1) {
        this.response_timelimit = 10000;
        this.crrnt_phase = 'practice_strict';
        this.teststim = this.itemgenP.main_items(this.stim_base);
      } else {
        this.response_timelimit = this.response_timelimit_main;
        this.teststim = this.itemgenP.filler_items(this.targetrefs, this.nontargrefs);
      }
    } else if (this.blocknum == 2) {
      if (this.cit_type === 1) {
        this.response_timelimit = this.response_timelimit_main;
        this.teststim = this.itemgenP.main_items(this.stim_base);
      } else if (this.cit_type === 2) {
        this.response_timelimit = this.response_timelimit_main;
        this.teststim = this.itemgenP.practice_items(this.targetrefs, this.nontargrefs);
      } else {
        this.response_timelimit = 10000;
        this.crrnt_phase = 'practice_strict';
        this.teststim = this.itemgenP.main_items(this.stim_base);
      }
    } else if (this.blocknum == 3 && this.cit_type === 0) {
      this.response_timelimit = this.response_timelimit_main;
      this.teststim = this.itemgenP.practice_items(this.targetrefs, this.nontargrefs);
    } else {
      this.crrnt_phase = 'main';
      this.response_timelimit = this.response_timelimit_main;
      for (let i = 0; i < this.num_of_blocks; i++) {
        if (this.cit_type === 1) {
          this.all_teststms.push(this.itemgenP.fulltest_standard_items());
        } else {
          this.all_teststms.push(this.itemgenP.fulltest_items(this.targetrefs, this.nontargrefs));
        }
      }
      this.teststim = this.all_teststms.shift();
    }
    if (this.to_slice !== 0) {
      this.teststim = this.teststim.slice(0, this.to_slice);
    }
    this.rt_data_dict = {};
    this.switch_divs('div_blockstart');
  }

  // show the "starting trial" before the first trial ("touch to begin")
  runblock() {
    this.bg_color = "#000000";
    this.switch_divs('div_cit_main')
    this.visib.start_text = true;
  }

  // record response (touch start) in an ongoing CIT
  touchstart(ev, response_side) {
    if (this.listen === true) {
      this.rt_start = performance.now() - this.start;
      clearTimeout(this.response_window);
      this.listen = false;
      this.rspns = response_side;
      this.listn_end = true;
      if (this.rspns == this.correct_resp) {
        this.post_resp_hold();
      } else {
        this.flash_false();
      }
    }
  }
  // record response ending (touch end) in an ongoing CIT
  touchend(ev, end_resp_side) {
    if (this.listn_end == true && end_resp_side == this.rspns) {
      this.rt_end = performance.now() - this.start;
      this.listn_end = false;
    }
  }

  // DATA STORING

  // at the end of CIT, save data to file
  store_data() {
    this.get_results();
    this.file.writeFile(this.path, this.cit_results.file_name, this.cit_results.cit_data).then(value => {
      this.switch_divs('div_end');
    }, reason => {
      this.switch_divs('div_end');
      this.cit_results.file_nam_disp = this.cit_results.file_name + ' There was an error saving this file. Data data can still be retrieved by copying it to the clipboard. Error: ' + reason;
    });
    let somecode = this.neat_date() + Math.random().toString(36).slice(2);
    this.dataShare.storage.set('test-' + somecode, this.trP.lang + this.neat_date().slice(0, 8));
  }

  // the code below is for the detailed display of outcomes in the app interface
  cit_results: any = {
    "probe1": {},
    "probe2": {},
    "probe3": {},
    "probe4": {},
    "probe5": {},
    "ar_overall": '',
    'subj_id': '',
    'cit_data': '',
    'date': '',
    'file_name': '',
    'file_nam_disp': ''
  };
  stored_results: any = {};
  get_results() {
    this.cit_results = {
      "probe1": {},
      "probe2": {},
      "probe3": {},
      "probe4": {},
      "probe5": {}
    };
    let allmain = [];
    // aggregated data per item (each potential probe)
    Object.keys(this.cit_results).map((dkey) => {
      let probe = this.all_rts[dkey];
      allmain = allmain.concat(probe);
      let irrs = [];
      Object.keys(this.cit_results).map((dkey2) => {
        if (dkey !== dkey2) {
          irrs = irrs.concat(this.all_rts[dkey2])
        }
      });
      // -1 tooslow, 0 incorrect
      this.cit_results[dkey].acc_probe = probe.filter(x => x > 1).length / probe.filter(x => x !== -2).length;
      this.cit_results[dkey].acc_irr = irrs.filter(x => x > 1).length / irrs.filter(x => x !== -2).length;
      this.cit_results[dkey].acc_p_vs_i = this.cit_results[dkey].acc_probe - this.cit_results[dkey].acc_irr;
      let rts_prob = probe.filter(x => x > 1);
      let rts_irr = irrs.filter(x => x > 1);
      if (probe.length > 2 && irrs.length > 2) {
        this.cit_results[dkey].rt_probe = this.mean(rts_prob);
        this.cit_results[dkey].rt_probe_sd = this.sd(rts_prob);
        this.cit_results[dkey].rt_irr = this.mean(rts_irr);
        this.cit_results[dkey].rt_irr_sd = this.sd(rts_irr);
        this.cit_results[dkey].rt_p_vs_i = this.mean(rts_prob) - this.mean(rts_irr);
        this.cit_results[dkey].dcit = (this.mean(rts_prob) - this.mean(rts_irr)) / this.sd_pooled(rts_prob, rts_irr);
      } else {
        this.cit_results[dkey].rt_probe = 'NA';
        this.cit_results[dkey].rt_probe_sd = 'NA';
        this.cit_results[dkey].rt_irr = 'NA';
        this.cit_results[dkey].rt_irr_sd = 'NA';
        this.cit_results[dkey].dcit = 'NA';
      }
      Object.keys(this.cit_results[dkey]).map((subkey) => {
        if (!isNaN(this.cit_results[dkey][subkey])) {
          if (subkey.slice(0, 3) == 'rt_') {
            this.cit_results[dkey][subkey] = (Math.round(this.cit_results[dkey][subkey] * 10) / 10).toFixed(1);
          } else if (subkey.slice(0, 4) === 'dcit') {
            this.cit_results[dkey][subkey] = (Math.round(this.cit_results[dkey][subkey] * 100) / 100).toFixed(2);
          } else {
            this.cit_results[dkey][subkey] = (Math.round(this.cit_results[dkey][subkey] * 1000) / 10).toFixed(1);
          }
          this.cit_results[dkey][subkey] = this.cit_results[dkey][subkey].replace('-', '−');
        } else {
          this.cit_results[dkey][subkey] = 'NA';
        }
      });
    });
    let ar_names = {
      'mains': 'main items (all probes) ',
      'target': 'target ',
      'targetflr': 'target fillers ',
      'nontargflr': 'nontarget fillers '
    };
    let ars = [];
    ['mains', 'target', 'targetflr', 'nontargflr'].map((dkey) => {
      let the_ar = NaN;
      if (dkey == 'mains') {
        the_ar = allmain.filter(x => x > 1).length / allmain.length;
      } else if (Object.keys(this.all_rts).indexOf(dkey) >= 0) {
        the_ar = this.all_rts[dkey].filter(x => x > 1).length / this.all_rts[dkey].length;
      }
      if (!isNaN(the_ar)) {
        ars.push(ar_names[dkey] + (Math.ceil(the_ar * 1000) / 10).toFixed(1) + '%');
      }
    })
    this.cit_results.ar_overall = ars.join(', ');

    this.cit_results.subj_id = this.subj_id;
    this.cit_results.cit_data = this.cit_data;
    let cdate = new Date();
    let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.cit_results.date = ("0" + cdate.getDate()).slice(-2) + " " +
      months[cdate.getMonth()] + " " +
      cdate.getFullYear() + " " +
      ("0" + cdate.getHours()).slice(-2) + ":" +
      ("0" + cdate.getMinutes()).slice(-2);

    let consentword: object = {
      99: 'noconsent',
      1: 'fullshare',
      2: 'noitemshare',
      0: 'noshare'
    };

    this.cit_results.file_name = this.subj_id + '_' +
      this.cittypedict[this.cit_type] + '_' +
      this.num_of_blocks + 'block_' +
      consentword[this.consented] + '_' + this.neat_date().slice(0, 12) + '.txt';
    this.cit_results.file_nam_disp = this.cit_results.file_name;
    this.stored_results[this.neat_date() + this.subj_id] = this.cit_results;
    this.dataShare.storage.set('reslts', this.stored_results);
  }

  // display given item (text or image) and wait for response
  item_display() {
    if (this.trial_stim.type === "target" || this.trial_stim.type.slice(0, 9) === "targetflr") {
      this.correct_resp = "resp_b";
    } else {
      this.correct_resp = "resp_a";
    }
    // this.touchsim(); // for testing -- TODOREMOVE
    requestAnimationFrame(() => {
      if (this.trial_stim.mode === 'image') {
        this.ctx.drawImage(this.task_images[this.trial_stim.item], 0, 0);
      } else {
        this.stimulus_text = this.text_to_show;
      }
      this.start = performance.now();
      this.listen = true;
      this.response_window = setTimeout(function() {
        this.rt_start = performance.now() - this.start;
        this.listen = false;
        this.flash_too_slow();
      }.bind(this), this.response_timelimit);
    });
  }

}
